import { call, put, takeLatest } from 'redux-saga/effects';
import * as ApiK8s from '../../services/k8s/api';

// Actions
const FETCH_PODS = 'FETCH_PODS';
export const SET_PODS = 'SET_PODS';

// Reducer
const defaultState = {
  list: [],
};

export default function reducer(state = defaultState, action = {}) {
  switch (action.type) {
    case SET_PODS:
      return { ...state, list: action.payload };
    default:
      return state;
  }
}

// Action Creators
export const fetchPodsAction = () => {
  return { type: FETCH_PODS };
};

export const setPodsAction = (payload) => {
  return { type: SET_PODS, payload };
};

// Sagas
export function* fetchPods() {
  const result = yield call(ApiK8s.getPods);
  if (!result.error) {
    yield put(
      setPodsAction(
        result.body.items.map((pod) => ({
          name: pod.metadata.name,
          namespace: pod.metadata.namespace,
          nodeName: pod.spec.nodeName,
          status: pod.status.phase,
          startTime: pod.status.startTime,
          restartCount:
            pod.status.containerStatuses && pod.status.containerStatuses.length
              ? pod.status.containerStatuses[0].restartCount
              : 0,
          volumes: pod.spec.volumes.map((volume) => ({
            name: volume.name,
            persistentVolumeClaim: volume?.persistentVolumeClaim?.claimName,
          })),
        })),
      ),
    );
  }
}

export function* podsSaga() {
  yield takeLatest(FETCH_PODS, fetchPods);
}
