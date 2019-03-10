import { remote } from 'electron';
import React from 'react';
import ReactDOM from 'react-dom';

import SettingsPage from '../ui/pages/SettingsPage';

ReactDOM.render(<SettingsPage />, document.querySelector('#settings-window'));
remote.getCurrentWindow().show();
