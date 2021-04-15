package salt

import "fmt"

type TokenType string

// "Enum" representing the preparation steps of a volume.
const (
	BasicToken  TokenType = "Basic"
	BearerToken TokenType = "Bearer"
)

// Credentials for Salt API.
type Credential struct {
	username string    // User name.
	token    string    // User token.
	kind     TokenType // Token type: Basic or Bearer.
}

// Create a new Salt API client.
//
// Arguments
//     username: user name
//     token:    user token
//     kind:     token type (must be either Basic or Bearer)
func NewCredential(username string, token string, kind TokenType) *Credential {
	if kind != BasicToken && kind != BearerToken {
		panic(fmt.Sprintf("invalid token type: %s", kind))
	}
	return &Credential{username: username, token: token, kind: kind}
}
