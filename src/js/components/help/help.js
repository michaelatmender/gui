import React from 'react';
import { matchPath } from 'react-router-dom';
import PropTypes from 'prop-types';
import LeftNav from './left-nav';
import GettingStarted from './getting-started';
import ApplicationUpdates from './application-updates';
import DebPackage from './application-updates/mender-deb-package';
import VirtualDevice from './application-updates/demo-virtual-device';
import UpdateModules from './application-updates/update-modules';
import SystemUpdates from './system-updates';
import BoardIntegrations from './system-updates/board-integrations';
import BuildYocto from './system-updates/build-with-yocto';
import IntegrateDebian from './system-updates/integrate-debian';
import Support from './support';
import MoreHelp from './more-help-resources';
import { isEmpty, versionCompare } from '../../helpers';

import AppStore from '../../stores/app-store';
import AppActions from '../../actions/app-actions';

var components = {
  'getting-started': {
    title: 'Getting started',
    component: GettingStarted,
  },
  'application-updates': {
    title: 'Application updates',
    component: ApplicationUpdates,
    'mender-deb-package': {
      title: 'Connecting your device using Mender .deb package',
      component: DebPackage,
    },
    'demo-virtual-device': {
      title: 'Connecting a demo virtual device',
      component: VirtualDevice,
    },
    'update-modules': {
      title: 'Enabling different kinds of updates with Update Modules',
      component: UpdateModules,
    },
   },
   'system-updates': {
    title: 'System updates',
    component: SystemUpdates,
    'board-integrations': {
      title: 'Supported board integrations on Mender Hub',
      component: BoardIntegrations
    },
    'build-with-yocto': {
      title: 'Building a Mender-enabled Yocto image',
      component: BuildYocto
    },
    'integrate-debian': {
      title: 'Devices running Debian family',
      component: IntegrateDebian
    }
  },
  'support': {
    title: 'Support',
    component: Support,
  },
  'more-help-resources': {
    title: 'More resources',
    component: MoreHelp,
  }
};

export default class Help extends React.Component {
  static contextTypes = {
    router: PropTypes.object
  };

  constructor(props, context) {
    super(props, context);
    this.state = this._getInitialState();
  }
  _getInitialState() {
    return {
      snackbar: AppStore.getSnackbar(),
      hasMultitenancy: AppStore.hasMultitenancy(),
      isHosted: window.location.hostname === 'hosted.mender.io'
    };
  }
  componentDidMount() {
    if (this.state.hasMultitenancy && this.state.isHosted) {
      this._getUserOrganization();
      this.setState({ version: '', docsVersion: '' }); // if hosted, use latest docs version
    } else {
      this.setState({ docsVersion: this.props.docsVersion ? `${this.props.docsVersion}/` : 'development/' });
    }
  }

  _getUserOrganization() {
    var self = this;
    return AppActions.getUserOrganization()
      .then(org => {
        self.setState({ org: org });
        self.linksTimer = setInterval(() => {
          self._getLinks(org.id);
        }, 30000);
        self._getLinks(org.id);
      })
      .catch(err => console.log(`Error: ${err}`));
  }

  _getLinks(id) {
    var self = this;
    AppActions.getHostedLinks(id)
      .then(response => {
        self.setState({ links: response });
        // clear timer when got links successfully
        clearInterval(self.linksTimer);
      })
      .catch(err => console.log(`Error: ${err}`, `Tenant id: ${id}`));
  }

  componentWillMount() {
    AppStore.changeListener(this._onChange.bind(this));
  }

  componentWillUnmount() {
    clearInterval(this.linksTimer);
    AppStore.removeChangeListener(this._onChange.bind(this));
  }

  _onChange() {
    this.setState(this._getInitialState());
  }

  _getLatest(array) {
    // returns latest version of format x.x.x
    array.sort(versionCompare);
    return array[array.length - 1];
  }

  render() {
    var ComponentToShow = GettingStarted;
    let routeParams = matchPath(this.props.location.pathname, { path: '/help/**' });
    if (routeParams && routeParams.params[0]) {
      var splitsplat = routeParams.params[0].split('/');
      var copyOfComponents = components;

      for (var i = 0; i < splitsplat.length; i++) {
        if (i === splitsplat.length - 1) {
          ComponentToShow = copyOfComponents[splitsplat[i]].component;
        } else {
          copyOfComponents = copyOfComponents[splitsplat[i]];
        }
      }
    }

    return (
      <div style={{ marginTop: '-15px' }}>
        <div className="leftFixed">
          <LeftNav pages={components} />
        </div>
        <div className="rightFluid padding-right" style={{ maxWidth: '780px', paddingTop: '1px', paddingLeft: '70px' }}>
          <h5>Help</h5>
          <div style={{ position: 'relative', top: '12px' }} className="help-content">
            <ComponentToShow
              version={this.props.version}
              docsVersion={this.state.docsVersion}
              getLatest={this._getLatest}
              isHosted={this.state.isHosted}
              org={this.state.org}
              links={this.state.links}
              hasMultitenancy={this.state.hasMultitenancy}
              isEmpty={isEmpty}
              pages={components}
            />
          </div>
        </div>
      </div>
    );
  }
}
