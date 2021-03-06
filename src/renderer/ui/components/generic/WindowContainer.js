import { remote } from 'electron';
import React, { Component, PropTypes } from 'react';

import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';

import PlatformSpecific from './PlatformSpecific';
import generateTheme from '../../utils/theme';

export default class WindowContainer extends Component {
  static propTypes = {
    children: PropTypes.oneOfType([
      PropTypes.array,
      PropTypes.object,
    ]).isRequired,
    confirmClose: PropTypes.func,
    isMainWindow: PropTypes.bool,
    title: PropTypes.string.isRequired,
  };

  constructor(...args) {
    super(...args);

    this.state = {
      nativeFrame: Settings.get('nativeFrame'),
      theme: Settings.get('theme'),
      themeColor: Settings.get('themeColor'),
      themeType: Settings.get('themeType', 'FULL'),
      isFullscreen: remote.getCurrentWindow().isFullScreen(),
    };
  }

  componentDidMount() {
    Emitter.on('settings:change:theme', this._themeUpdate);
    Emitter.on('settings:change:themeColor', this._themeColorUpdate);
    Emitter.on('settings:change:themeType', this._themeTypeUpdate);
    Emitter.on('window:changefullscreen', this._updateFullscreen);
  }

  componentWillUnmount() {
    Emitter.off('settings:change:theme', this._themeUpdate);
    Emitter.off('settings:change:themeColor', this._themeColorUpdate);
    Emitter.off('settings:change:themeType', this._themeTypeUpdate);
    Emitter.off('window:changefullscreen', this._updateFullscreen);
  }

  _darwinExpand = () => {
    const doubleClickAction = remote.systemPreferences.getUserDefault('AppleActionOnDoubleClick', 'string');
    if (doubleClickAction === 'Minimize') {
      this.minWindow();
    } else if (doubleClickAction === 'Maximize') {
      this.maxWindow();
    }
  }

  _updateFullscreen = (event, isFullscreen) => {
    this.setState({
      isFullscreen,
    });
  }

  _themeUpdate = (event, theme) => {
    this.setState({ theme });
  }

  _themeColorUpdate = (event, themeColor) => {
    this.setState({ themeColor });
  }

  _themeTypeUpdate = (event, themeType) => {
    this.setState({ themeType });
  }

  minWindow = () => {
    Emitter.fire('window:minimize', remote.getCurrentWindow().id);
  }

  maxWindow = () => {
    Emitter.fire('window:maximize', remote.getCurrentWindow().id);
  }

  closeWindow = () => {
    Emitter.fire('window:close', remote.getCurrentWindow().id);
  }

  render() {
    const muiTheme = generateTheme(this.state.theme, this.state.themeColor, this.state.themeType);

    const fadedBackground = {};
    if (this.state.theme && this.state.themeType === 'FULL') {
      fadedBackground.backgroundColor = '#121212';
      fadedBackground.color = '#FAFAFA';
    }

    return (
      <MuiThemeProvider muiTheme={muiTheme}>
        <section className={`window-border ${this.state.isFullscreen ? 'fullscreen' : ''}`} style={{ borderColor: muiTheme.tabs.backgroundColor }}>
          <PlatformSpecific platform="darwin">
            <header className="darwin-title-bar" onDoubleClick={this._darwinExpand} style={{ backgroundColor: muiTheme.tabs.backgroundColor, height: this.state.isFullscreen ? 0 : 23 }}>
              <div className="title">{this.props.title}</div>
            </header>
          </PlatformSpecific>
          <header className="title-bar" style={{ backgroundColor: muiTheme.tabs.backgroundColor }}>
            <div className="drag-handle" />
            <div className="controls">
              {
                ['min', 'max', 'close'].map((action) => (
                  <div key={action} className="control" onClick={this[`${action}Window`]}>
                    <img src={`../assets/img/control_bar/${action}.png`} alt={action} />
                  </div>
                ))
              }
            </div>
          </header>
          {
            this.props.isMainWindow ?
            (
              <main className="embedded-player-container" style={fadedBackground}>
                {
                  this.props.children
                }
              </main>
            ) :
            (
              <main className="dialog">
                {
                  !(process.platform === 'darwin' && this.state.nativeFrame) ?
                  (
                    <div className="window-title" style={{ backgroundColor: muiTheme.tabs.backgroundColor }}>
                      {this.props.title}
                    </div>
                  ) : null
                }
                <div className="window-main" style={fadedBackground}>
                  {
                    this.props.children
                  }
                </div>
              </main>
            )
          }
        </section>
      </MuiThemeProvider>
    );
  }
}
