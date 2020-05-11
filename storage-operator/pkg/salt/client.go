package salt

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/go-logr/logr"
	"github.com/pkg/errors"
	"sigs.k8s.io/controller-runtime/pkg/runtime/log"
)

type AsyncJobFailed struct {
	reason string
}

func (self *AsyncJobFailed) Error() string {
	return self.reason
}

// A Salt API client.
type Client struct {
	address string       // Address of the Salt API server.
	client  *http.Client // HTTP client to query Salt API.
	creds   *Credential  // Salt API authentication credentials.
	token   *authToken   // Salt API authentication token.
	logger  logr.Logger  // Logger for the client's requests
}

// Create a new Salt API client.
func NewClient(creds *Credential, caCertData []byte) (*Client, error) {
	address := os.Getenv("METALK8S_SALT_MASTER_ADDRESS")
	if address == "" {
		address = "https://salt-master:4507"
	}
	logger := log.Log.WithName("salt-api").WithValues("Salt.Address", address)

	if len(caCertData) == 0 {
		return nil, fmt.Errorf("Empty CA certificate")
	}

	certs := x509.NewCertPool()
	certs.AppendCertsFromPEM(caCertData)
	return &Client{
		address: address,
		client: &http.Client{
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{RootCAs: certs},
			},
		},
		creds:  creds,
		token:  nil,
		logger: logger,
	}, nil
}

// Spawn a job, asynchronously, to prepare the volume on the specified node.
//
// Arguments
//     ctx:        the request context (used for cancellation)
//     nodeName:   name of the node where the volume will be
//     volumeName: name of the volume to prepare
//     saltenv:    saltenv to use
//
// Returns
//     The Salt job ID.
func (self *Client) PrepareVolume(
	ctx context.Context, nodeName string, volumeName string, saltenv string,
) (string, error) {
	payload := map[string]interface{}{
		"client": "local_async",
		"tgt":    nodeName,
		"fun":    "state.sls",
		"kwarg": map[string]interface{}{
			"mods":    "metalk8s.volumes",
			"saltenv": saltenv,
			"pillar":  map[string]interface{}{"volume": volumeName},
		},
	}

	self.logger.Info(
		"PrepareVolume", "Volume.NodeName", nodeName, "Volume.Name", volumeName,
	)

	ans, err := self.authenticatedRequest(ctx, "POST", "/", payload)
	if err != nil {
		return "", errors.Wrapf(
			err,
			"PrepareVolume failed (env=%s, target=%s, volume=%s)",
			saltenv, nodeName, volumeName,
		)
	}
	// TODO(#1461): make this more robust.
	result := ans["return"].([]interface{})[0].(map[string]interface{})
	return result["jid"].(string), nil
}

// Spawn a job, asynchronously, to unprepare the volume on the specified node.
//
// Arguments
//     ctx:      the request context (used for cancellation)
//     nodeName: name of the node where the volume will be
//     volumeName: name of the volume to prepare
//     saltenv:    saltenv to use
//
// Returns
//     The Salt job ID.
func (self *Client) UnprepareVolume(
	ctx context.Context, nodeName string, volumeName string, saltenv string,
) (string, error) {
	payload := map[string]interface{}{
		"client": "local_async",
		"tgt":    nodeName,
		"fun":    "state.sls",
		"kwarg": map[string]interface{}{
			"mods":    "metalk8s.volumes.unprepared",
			"saltenv": saltenv,
			"pillar":  map[string]interface{}{"volume": volumeName},
		},
	}

	self.logger.Info(
		"UnprepareVolume",
		"Volume.NodeName", nodeName, "Volume.Name", volumeName,
	)

	ans, err := self.authenticatedRequest(ctx, "POST", "/", payload)
	if err != nil {
		return "", errors.Wrapf(
			err,
			"UnrepareVolume failed (env=%s, target=%s, volume=%s)",
			saltenv, nodeName, volumeName,
		)
	}
	// TODO(#1461): make this more robust.
	result := ans["return"].([]interface{})[0].(map[string]interface{})
	return result["jid"].(string), nil
}

// Poll the status of an asynchronous Salt job.
//
// Arguments
//     ctx:      the request context (used for cancellation)
//     jobId:    Salt job ID
//     nodeName: node on which the job is executed
//
// Returns
//     The result of the job if the execution is over, otherwise nil.
func (self *Client) PollJob(
	ctx context.Context, jobId string, nodeName string,
) (map[string]interface{}, error) {
	jobLogger := self.logger.WithValues("Salt.JobId", jobId)
	jobLogger.Info("polling Salt job")

	endpoint := fmt.Sprintf("/jobs/%s", jobId)
	ans, err := self.authenticatedRequest(ctx, "GET", endpoint, nil)
	if err != nil {
		return nil, errors.Wrapf(
			err, "Salt job polling failed for ID %s", jobId,
		)
	}

	// TODO(#1461): make this more robust.
	info := ans["info"].([]interface{})[0].(map[string]interface{})

	// Unknown Job ID: maybe the Salt server restarted or something like that.
	if errmsg, found := info["Error"]; found {
		jobLogger.Info("Salt job not found")
		reason := fmt.Sprintf(
			"cannot get status for job %s: %s", jobId, (errmsg).(string),
		)
		return nil, errors.New(reason)
	}
	result := info["Result"].(map[string]interface{})
	// No result yet, the job is still running.
	if len(result) == 0 {
		jobLogger.Info("Salt job is still running")
		return nil, nil
	}
	nodeResult := result[nodeName].(map[string]interface{})

	// The job is done: check if it has succeeded.
	retcode := result[nodeName].(map[string]interface{})["retcode"].(float64)

	switch int(retcode) {
	case 0:
		jobLogger.Info("Salt job succeeded")
		return nodeResult, nil
	case 1: // Concurrent state execution.
		return nil, fmt.Errorf("Salt job %s failed to run", jobId)
	default:
		jobLogger.Info("Salt job failed")
		reason := getStateFailureRootCause(nodeResult["return"])
		return nil, &AsyncJobFailed{reason}
	}
}

func getStateFailureRootCause(output interface{}) string {
	const non_root_error_prefix string = "One or more requisite failed"

	switch error := output.(type) {
	case string:
		return error
	case map[string]interface{}:
		for key := range error {
			status := error[key].(map[string]interface{})
			success := status["result"].(bool)
			reason := status["comment"].(string)
			if !success && !strings.HasPrefix(reason, non_root_error_prefix) {
				return reason
			}
		}
		return "state failed, root cause not found"
	default:
		return fmt.Sprintf("unknown error type (%T)", error)
	}
}

// Return the size of the specified device on the given node.
//
// This request is synchronous.
//
// Arguments
//     ctx:        the request context (used for cancellation)
//     nodeName:   name of the node where the volume will be
//     devicePath: path of the device for which we want the size
//
// Returns
//     The size of the device, in bytes.
func (self *Client) GetVolumeSize(
	ctx context.Context, nodeName string, devicePath string,
) (int64, error) {
	payload := map[string]interface{}{
		"client":  "local",
		"tgt":     nodeName,
		"fun":     "disk.dump",
		"arg":     devicePath,
		"timeout": 1,
	}

	self.logger.Info("disk.dump")

	ans, err := self.authenticatedRequest(ctx, "POST", "/", payload)
	if err != nil {
		return 0, errors.Wrapf(
			err, "disk.dump failed (target=%s, path=%s)", nodeName, devicePath,
		)
	}
	// TODO(#1461): make this more robust.
	result := ans["return"].([]interface{})[0].(map[string]interface{})
	if nodeResult, ok := result[nodeName].(map[string]interface{}); ok {
		size_str := nodeResult["getsize64"].(string)
		return strconv.ParseInt(size_str, 10, 64)
	}

	return 0, fmt.Errorf(
		"no size in disk.dump response (target=%s, path=%s)",
		nodeName, devicePath,
	)
}

// Send an authenticated request to Salt API.
//
// Automatically handle:
// - missing token (authenticate)
// - token expiration (re-authenticate)
// - token invalidation (re-authenticate)
//
// Arguments
//     ctx:      the request context (used for cancellation)
//     verb:     HTTP verb used for the request
//     endpoint: API endpoint.
//     payload:  request JSON payload (optional)
//
// Returns
//     The decoded response body.
func (self *Client) authenticatedRequest(
	ctx context.Context,
	verb string,
	endpoint string,
	payload map[string]interface{},
) (map[string]interface{}, error) {
	// Authenticate if we don't have a valid token.
	if self.token == nil || self.token.isExpired() {
		if err := self.authenticate(ctx); err != nil {
			return nil, err
		}
	}

	response, err := self.doRequest(ctx, verb, endpoint, payload, true)
	if err != nil {
		return nil, err
	}
	// Maybe the token got invalidated by a restart of the Salt API server.
	// => Re-authenticate and retry.
	if response.StatusCode == 401 {
		self.logger.Info("valid token rejected: try to re-authenticate")

		response.Body.Close() // Terminate this request before starting another.

		self.token = nil
		if err := self.authenticate(ctx); err != nil {
			return nil, err
		}
		response, err = self.doRequest(ctx, verb, endpoint, payload, true)
	}
	defer response.Body.Close()

	return decodeApiResponse(response)
}

// Authenticate against the Salt API server.
func (self *Client) authenticate(ctx context.Context) error {
	payload := map[string]interface{}{
		"eauth":    "kubernetes_rbac",
		"username": self.creds.username,
	}

	if self.creds.kind == BearerToken {
		payload["token"] = self.creds.token
	} else {
		payload["password"] = self.creds.token
	}

	self.logger.Info(
		"Auth", "username", payload["username"], "type", string(self.creds.kind),
	)

	response, err := self.doRequest(ctx, "POST", "/login", payload, false)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	result, err := decodeApiResponse(response)
	if err != nil {
		return errors.Wrapf(
			err,
			"Salt API authentication failed (username=%s, type=%s)",
			self.creds.username, string(self.creds.kind),
		)
	}

	// TODO(#1461): make this more robust.
	output := result["return"].([]interface{})[0].(map[string]interface{})
	self.token = newToken(
		output["token"].(string), output["expire"].(float64),
	)
	return nil
}

// Send a request to Salt API.
//
// Arguments
//     ctx:      the request context (used for cancellation)
//     verb:     HTTP verb used for the request
//     endpoint: API endpoint.
//     payload:  request JSON payload (optional).
//     is_auth:  Is the request authenticated?
//
// Returns
//     The request response.
func (self *Client) doRequest(
	ctx context.Context,
	verb string,
	endpoint string,
	payload map[string]interface{},
	is_auth bool,
) (*http.Response, error) {
	var response *http.Response = nil

	// Setup the translog.
	defer func(start time.Time) {
		elapsed := int64(time.Since(start) / time.Millisecond)
		self.logRequest(verb, endpoint, response, elapsed)
	}(time.Now())

	request, err := self.newRequest(verb, endpoint, payload, is_auth)
	if err != nil {
		return nil, errors.Wrapf(err, "cannot create %s request", verb)
	}
	request = request.WithContext(ctx)

	// Send the request.
	response, err = self.client.Do(request)
	if err != nil {
		return nil, errors.Wrapf(err, "%s failed on Salt API", verb)
	}
	return response, nil
}

// Log an HTTP request.
//
// Arguments
//     verb:     HTTP verb used for the request
//     endpoint: API endpoint.
//     response: HTTP response (if any)
//     elapsed:  response time (in ms)
func (self *Client) logRequest(
	verb string, endpoint string, response *http.Response, elapsed int64,
) {
	url := fmt.Sprintf("%s%s", self.address, endpoint)

	if response != nil {
		self.logger.Info(verb,
			"url", url, "StatusCode", response.StatusCode, "duration", elapsed,
		)
	} else {
		self.logger.Info(verb, "url", url, "duration", elapsed)
	}
}

// Create an HTTP request for Salt API.
//
// Arguments
//     verb:     HTTP verb used for the request
//     endpoint: API endpoint.
//     payload:  request JSON payload (optional).
//     is_auth:  Is the request authenticated?
//
// Returns
//     The HTTP request.
func (self *Client) newRequest(
	verb string, endpoint string, payload map[string]interface{}, is_auth bool,
) (*http.Request, error) {
	// Build target URL.
	url := fmt.Sprintf("%s%s", self.address, endpoint)

	// Encode the payload into JSON.
	var body []byte = nil
	if payload != nil {
		var err error
		body, err = json.Marshal(payload)
		if err != nil {
			return nil, errors.Wrapf(err, "cannot serialize %s body", verb)
		}
	}

	// Prepare the HTTP request.
	request, err := http.NewRequest(verb, url, bytes.NewBuffer(body))
	if err != nil {
		return nil, errors.Wrapf(
			err, "cannot prepare %s query for Salt API", verb,
		)
	}

	query := request.URL.Query()
	query.Add("timeout", "1")
	request.URL.RawQuery = query.Encode()

	request.Header.Set("Accept", "application/json")
	request.Header.Set("Content-Type", "application/json")
	if is_auth {
		request.Header.Set("X-Auth-Token", self.token.value)
	}
	return request, nil
}

// Decode the HTTP response body.
//
// Arguments
//     response: the HTTP response.
//
// Returns
//     The decoded API response.
func decodeApiResponse(response *http.Response) (map[string]interface{}, error) {
	// Check the return code before trying to decode the body.
	if response.StatusCode != 200 {
		errmsg := fmt.Sprintf(
			"Salt API failed with code %d", response.StatusCode,
		)
		// No decode: Salt API may returns HTML even when you asked for JSON…
		buf, err := ioutil.ReadAll(response.Body)
		if err == nil {
			errmsg = fmt.Sprintf("%s: %s", errmsg, string(buf))
		}
		return nil, errors.New(errmsg)
	}
	// Decode the response body.
	var result map[string]interface{}
	if err := json.NewDecoder(response.Body).Decode(&result); err != nil {
		return nil, errors.Wrap(err, "cannot decode Salt API response")
	}
	return result, nil
}
