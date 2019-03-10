import { remote } from 'electron';
import React from 'react';
import ReactDOM from 'react-dom';

import PlayerPage from '../ui/pages/PlayerPage';


ReactDOM.render(<PlayerPage />, document.querySelector('#main-window'));

// minimize if 'start minimized' is on.
if (Settings.get('startMinimized', false) || remote.app.getLoginItemSettings().wasOpenedAsHidden) {
  if (Settings.get('minToTray', false)) {
    // .minimize will show on the windows taskbar even if minToTray is true
    // Since, minToTray is on we can safely close without killing
    remote.getCurrentWindow().close();
  } else {
    remote.getCurrentWindow().minimize();
  }
} else {
  remote.getCurrentWindow().show();
}
