import { call, put, takeEvery } from 'redux-saga/effects';
import { mergeTheme } from '@scality/core-ui/dist/utils';
import * as defaultTheme from '@scality/core-ui/dist/style/theme';
import * as Api from '../services/api';
import * as ApiK8s from '../services/k8s/api';
import * as ApiSalt from '../services/salt/api';
import * as ApiPrometheus from '../services/prometheus/api';

import { fetchUserInfo } from './login';

// Actions
const SET_LANG = 'SET_LANG';
export const SET_THEME = 'SET_THEME';
const FETCH_THEME = 'FETCH_THEME';
const FETCH_CONFIG = 'FETCH_CONFIG';
export const SET_API_CONFIG = 'SET_API_CONFIG';
const SET_INITIAL_LANGUAGE = 'SET_INITIAL_LANGUAGE';

// Reducer
const defaultState = {
  language: 'en',
  theme: {},
  api: null
};

export default function reducer(state = defaultState, action = {}) {
  switch (action.type) {
    case SET_LANG:
      return { ...state, language: action.payload };
    case SET_THEME:
      return { ...state, theme: action.payload };
    case SET_API_CONFIG:
      return { ...state, api: action.payload };
    default:
      return state;
  }
}

// Action Creators
export function setLanguageAction(newLang) {
  return { type: SET_LANG, payload: newLang };
}

export function setThemeAction(theme) {
  return { type: SET_THEME, payload: theme };
}

export function fetchThemeAction() {
  return { type: FETCH_THEME };
}

export function fetchConfigAction() {
  return { type: FETCH_CONFIG };
}

export function setApiConfigAction(conf) {
  return { type: SET_API_CONFIG, payload: conf };
}

export function setInitialLanguageAction() {
  return { type: SET_INITIAL_LANGUAGE };
}

// Sagas
export function* fetchTheme() {
  const result = yield call(Api.fetchTheme);
  if (!result.error) {
    result.brand = mergeTheme(result, defaultTheme);
    yield put(setThemeAction(result));
  }
}

export function* fetchConfig() {
  yield call(Api.initialize, process.env.PUBLIC_URL);
  const result = yield call(Api.fetchConfig);
  if (!result.error) {
    yield call(fetchTheme);
    yield put(setApiConfigAction(result));
    yield call(ApiK8s.initialize, result.url);
    yield call(ApiSalt.initialize, result.url_salt);
    yield call(ApiPrometheus.initialize, result.url_prometheus);
    yield call(fetchUserInfo);
  }
}

export function* setInitialLanguage() {
  const languageLocalStorage = localStorage.getItem('language');
  if (languageLocalStorage) {
    languageLocalStorage === 'fr'
      ? yield put(setLanguageAction('fr'))
      : yield put(setLanguageAction('en'));
  } else {
    yield put(
      setLanguageAction(navigator.language.startsWith('fr') ? 'fr' : 'en')
    );
  }
}

export function* configSaga() {
  yield takeEvery(FETCH_THEME, fetchTheme);
  yield takeEvery(FETCH_CONFIG, fetchConfig);
  yield takeEvery(SET_INITIAL_LANGUAGE, setInitialLanguage);
}
