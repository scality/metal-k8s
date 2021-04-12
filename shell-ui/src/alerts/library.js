import { version } from '../../package.json';
import * as alertLibrary from './AlertProvider';

window.shellUIAlerts = {
  ///spread shellUI to keep all versions libraries
  ...window.shellUIAlerts,
  [version]: alertLibrary,
};
