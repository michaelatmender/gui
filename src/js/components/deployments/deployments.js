import React from 'react';
import { Link } from 'react-router-dom';
import cookie from 'react-cookie';
import PropTypes from 'prop-types';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Tab, Tabs } from '@material-ui/core';

import AppStore from '../../stores/app-store';
import AppActions from '../../actions/app-actions';
import { setRetryTimer, clearRetryTimer, clearAllRetryTimers } from '../../utils/retrytimer';

import Loader from '../common/loader';
import DeploymentsList from './deploymentslist';
import Progress from './inprogressdeployments';
import Past from './pastdeployments';
import Report from './report';
import CreateDialog from './createdeployment';

import { preformatWithRequestID } from '../../helpers';
import { getOnboardingComponentFor } from '../../utils/onboardingmanager';

const routes = {
  active: {
    route: '/deployments/active',
    title: 'Active'
  },
  finished: {
    route: '/deployments/finished',
    title: 'Finished'
  }
};

export default class Deployments extends React.Component {
  static contextTypes = {
    router: PropTypes.object
  };

  constructor(props, context) {
    super(props, context);
    const today = new Date();
    today.setHours(0, 0, 0);
    const tonight = new Date();
    tonight.setHours(23, 59, 59);
    this.state = {
      docsVersion: this.props.docsVersion ? `${this.props.docsVersion}/` : 'development/',
      invalid: true,
      startDate: today,
      endDate: tonight,
      per_page: 20,
      prog_page: 1,
      pend_page: 1,
      refreshDeploymentsLength: 30000,
      reportDialog: false,
      createDialog: false,
      ...this._getInitialState()
    };
  }

  componentWillMount() {
    AppStore.changeListener(this._onChange.bind(this));
  }

  componentDidMount() {
    var self = this;

    clearAllRetryTimers();
    this.timer = setInterval(() => this._refreshDeployments(), this.state.refreshDeploymentsLength);
    this._refreshDeployments();

    Promise.all([AppActions.getArtifacts(), AppActions.getAllDevices(), AppActions.getGroups()])
      .catch(err => console.log(`Error: ${err}`))
      .then(([artifacts, allDevices, groups]) => {
        const collatedArtifacts = AppStore.getCollatedArtifacts(artifacts);
        let state = { allDevices, collatedArtifacts, groups, doneLoading: true };
        return Promise.all([
          Promise.all(groups.map(group => AppActions.getAllDevicesInGroup(group).then(devices => Promise.resolve({ [group]: devices })))),
          Promise.resolve(state)
        ]);
      })
      .then(([groupedDevices, state]) => {
        state = groupedDevices.reduce((accu, item) => Object.assign(accu, item), state);
        self.setState(state);
      });

    if (this.props.match) {
      const params = new URLSearchParams(this.props.location.search);
      if (params && params.get('open')) {
        if (params.get('id')) {
          self._getReportById(params.get('id'));
        } else if (params.get('release')) {
          const release = self.flattenRelease(AppStore.getRelease(params.get('release')));
          const deploymentRelease = self.flattenRelease(AppStore.getDeploymentRelease());
          self.setState({
            scheduleDialog: true,
            release: release || deploymentRelease
          });
        } else if (params.get('deviceId')) {
          AppActions.getDeviceById(params.get('deviceId'))
            .then(device => { 
              self.setState({
                scheduleDialog: true,
                device: device,
                deploymentDeviceIds: [device.id],
              });
            })
            .catch(err => {
              console.log(err);
              var errMsg = err.res.body.error || '';
              AppActions.setSnackbar(preformatWithRequestID(err.res, `Error fetching device details. ${errMsg}`), null, 'Copy to clipboard');
            });
  
        } else {
          setTimeout(() => {
            self.setState({ createDialog: true });
          }, 400);
        }
      }
    }
    this.setState({ reportType: this.props.match ? this.props.match.params.tab : 'active' });

    const query = new URLSearchParams(this.props.location.search);
    this.setState({ createDialog: Boolean(query.get('open')) || false });
  }

  componentWillUnmount() {
    clearInterval(this.timer);
    clearAllRetryTimers();
    AppStore.removeChangeListener(this._onChange.bind(this));
  }

  flattenRelease(release) {
    if (release && release.hasOwnProperty('Artifacts')) {
      return release.Artifacts.reduce(
        (accu, item) => {
          accu.device_types_compatible = accu.device_types_compatible.concat(item.device_types_compatible);
          return accu;
        },
        { name: release.Name, device_types_compatible: [] }
      );
    }
    return release;
  }

  _getInitialState() {
    return {
      tabIndex: this._updateActive(),
      past: AppStore.getPastDeployments(),
      pending: AppStore.getPendingDeployments(),
      progress: AppStore.getDeploymentsInProgress() || [],
      events: AppStore.getEventLog(),
      hasDeployments: AppStore.getHasDeployments(),
      showHelptips: AppStore.showHelptips(),
      hasPending: AppStore.getTotalPendingDevices(),
      hasDevices: AppStore.getTotalAcceptedDevices(),
      user: AppStore.getCurrentUser(),
      pageLength: AppStore.getTotalDevices(),
      isHosted: AppStore.getIsHosted()
    };
  }

  _refreshDeployments() {
    if (this._getCurrentLabel() === 'Finished') {
      this._refreshPast(null, null, null, null, this.state.groupFilter);
    } else {
      this._refreshInProgress();
      this._refreshPending();
      if (!AppStore.getOnboardingComplete()) {
        this._refreshPast(null, null, null, null, this.state.groupFilter);
      }
    }

    if (this.state.showHelptips && cookie.load(`${this.state.user.id}-deploymentID`)) {
      this._isOnBoardFinished(cookie.load(`${this.state.user.id}-deploymentID`));
    }
  }
  _refreshInProgress(page, per_page) {
    /*
    / refresh only in progress deployments
    /
    */
    var self = this;
    if (page) {
      self.setState({ prog_page: page });
    } else {
      page = self.state.prog_page;
    }

    return Promise.all([
      AppActions.getDeploymentsInProgress(page, per_page),
      // Get full count of deployments for pagination
      AppActions.getDeploymentCount('inprogress')
    ])
      .then(results => {
        const deployments = results[0];
        const progressCount = results[1];
        self.setState({ doneLoading: true, progressCount });
        clearRetryTimer('progress');
        if (progressCount && !deployments.length) {
          self._refreshInProgress(1);
        }
      })
      .catch(err => {
        console.log(err);
        var errormsg = err.error || 'Please check your connection';
        setRetryTimer(err, 'deployments', `Couldn't load deployments. ${errormsg}`, self.state.refreshDeploymentsLength);
      });
  }
  _refreshPending(page, per_page) {
    /*
    / refresh only pending deployments
    /
    */
    var self = this;
    if (page) {
      self.setState({ pend_page: page });
    } else {
      page = self.state.pend_page;
    }

    return AppActions.getPendingDeployments(page, per_page)
      .then(result => {
        AppActions.setSnackbar('');
        const { deployments, links } = result;

        // Get full count of deployments for pagination
        if (links.next || links.prev) {
          return AppActions.getDeploymentCount('pending').then(pendingCount => {
            self.setState({ pendingCount });
            if (pendingCount && !deployments.length) {
              self._refreshPending(1);
            }
          });
        } else {
          self.setState({ pendingCount: deployments.length });
        }
      })
      .catch(err => {
        console.log(err);
        var errormsg = err.error || 'Please check your connection';
        setRetryTimer(err, 'deployments', `Couldn't load deployments. ${errormsg}`, self.state.refreshDeploymentsLength);
      });
  }

  _changePastPage(
    page = this.state.page,
    startDate = this.state.startDate,
    endDate = this.state.endDate,
    per_page = this.state.per_page,
    group = this.state.group
  ) {
    var self = this;
    self.setState({ doneLoading: false }, () => {
      clearInterval(self.timer);
      self._refreshPast(page, startDate, endDate, per_page, group);
      self.timer = setInterval(() => self._refreshDeployments(), self.state.refreshDeploymentsLength);
    });
  }
  _refreshPast(page, startDate, endDate, per_page, group) {
    /*
    / refresh only finished deployments
    /
    */
    var self = this;

    var oldCount = self.state.pastCount;
    var oldPage = self.state.past_page;

    startDate = startDate || self.state.startDate;
    endDate = endDate || self.state.endDate;
    per_page = per_page || self.state.per_page;

    self.setState({ startDate, endDate, groupFilter: group });

    startDate = Math.round(Date.parse(startDate) / 1000);
    endDate = Math.round(Date.parse(endDate) / 1000);

    // get total count of past deployments first
    return AppActions.getDeploymentCount('finished', startDate, endDate, group)
      .then(count => {
        page = page || self.state.past_page || 1;
        self.setState({ pastCount: count, past_page: page });
        // only refresh deployments if page, count or date range has changed
        if (oldPage !== page || oldCount !== count || !self.state.doneLoading) {
          return AppActions.getPastDeployments(page, per_page, startDate, endDate, group).then(AppActions.getDeploymentsWithStats);
        }
      })
      .then(() => {
        self.setState({ doneLoading: true });
        AppActions.setSnackbar('');
      })
      .catch(err => {
        console.log(err);
        self.setState({ doneLoading: true });
        var errormsg = err.error || 'Please check your connection';
        setRetryTimer(err, 'deployments', `Couldn't load deployments. ${errormsg}`, self.state.refreshDeploymentsLength);
      });
  }

  _onChange() {
    this.setState(this._getInitialState());
  }

  _retryDeployment(deployment, devices) {
    const self = this;
    const release = { name: deployment.artifact_name, device_types_compatible: deployment.device_types_compatible || [] };
    self.setState({ release, group: deployment.name, filteredDevices: devices }, () => self._onScheduleSubmit(deployment.name, devices, release));
  }

  _onScheduleSubmit(deploymentObject) {
    var self = this;
    const { group, deploymentDeviceIds, release, phases } = deploymentObject;
    var newDeployment = {
      name: decodeURIComponent(group) || 'All devices',
      artifact_name: release.name,
      devices: deploymentDeviceIds,
      phases: phases
    };
    self.setState({ doneLoading: false, createDialog: false });

    return AppActions.createDeployment(newDeployment)
      .then(data => {
        var lastslashindex = data.lastIndexOf('/');
        var id = data.substring(lastslashindex + 1);
        clearInterval(self.timer);

        // onboarding
        if (self.state.showHelptips && !cookie.load(`${self.state.user.id}-deploymentID`)) {
          cookie.save(`${self.state.user.id}-deploymentID`, id);
        }

        return AppActions.getSingleDeployment(id).then(data => {
          if (data) {
            // successfully retrieved new deployment
            if (self.state.currentTab !== 'Active') {
              self.context.router.history.push('/deployments/active');
              self._changeTab('/deployments/active');
            } else {
              self.timer = setInterval(() => self._refreshDeployments(), self.state.refreshDeploymentsLength);
              self._refreshDeployments();
            }
            AppActions.setSnackbar('Deployment created successfully', 8000);
          } else {
            AppActions.setSnackbar('Error while creating deployment');
          }
          return Promise.resolve();
        });
      })
      .then(() => self.setState({ doneLoading: true }))
      .catch(err => {
        var errMsg = err.res.body.error || '';
        AppActions.setSnackbar(preformatWithRequestID(err.res, `Error creating deployment. ${errMsg}`), null, 'Copy to clipboard');
      });
  }
  _getReportById(id) {
    var self = this;
    return AppActions.getSingleDeployment(id).then(data => self._showReport(data, self.state.reportType));
  }
  _showReport(selectedDeployment, reportType) {
    this.setState({ createDialog: false, selectedDeployment, reportType, reportDialog: true });
  }
  _showProgress(rowNumber) {
    var deployment = this.state.progress[rowNumber];
    this._showReport(deployment, 'active');
  }
  _abortDeployment(id) {
    var self = this;
    return AppActions.abortDeployment(id)
      .then(() => {
        self.setState({ doneLoading: false });
        clearInterval(self.timer);
        self.timer = setInterval(() => self._refreshDeployments(), self.state.refreshDeploymentsLength);
        self._refreshDeployments();
        self.setState({ createDialog: false });
        AppActions.setSnackbar('The deployment was successfully aborted');
      })
      .catch(err => {
        console.log(err);
        var errMsg = err.res.body.error || '';
        AppActions.setSnackbar(preformatWithRequestID(err.res, `There was wan error while aborting the deployment: ${errMsg}`));
      });
  }
  _isOnBoardFinished(id) {
    var self = this;
    return AppActions.getSingleDeployment(id).then(data => {
      if (data.status === 'finished') {
        cookie.remove(`${self.state.user.id}-deploymentID`);
      }
    });
  }

  _updateActive(tab = this.context.router.route.match.params.tab) {
    if (routes.hasOwnProperty(tab)) {
      return routes[tab].route;
    }
    return routes.active.route;
  }

  _getCurrentLabel(tab = this.context.router.route.match.params.tab) {
    if (routes.hasOwnProperty(tab)) {
      return routes[tab].title;
    }
    return routes.active.title;
  }

  _changeTab(tabIndex) {
    var self = this;
    clearInterval(self.timer);
    self.timer = setInterval(() => self._refreshDeployments(), self.state.refreshDeploymentsLength);
    self.setState({ tabIndex, currentTab: self._getCurrentLabel(), pend_page: 1, past_page: 1, prog_page: 1 }, () => self._refreshDeployments());
    AppActions.setSnackbar('');
  }

  render() {
    const self = this;
    var reportActions = [
      <Button key="report-action-button-1" onClick={() => self.setState({ reportDialog: false })}>
        Close
      </Button>
    ];

    var dialogContent = '';
    // use to make sure re-renders dialog at correct height when device list built
    const dialogProps = {
      updated: () => this.setState({ updated: true }),
      deployment: this.state.selectedDeployment
    };
    if (this.state.reportType === 'active') {
      dialogContent = <Report abort={id => this._abortDeployment(id)} {...dialogProps} />;
    } else {
      dialogContent = <Report retry={(deployment, devices) => this._retryDeployment(deployment, devices)} past={true} {...dialogProps} />;
    }

    // tabs
    const { past, per_page, pastCount, release, tabIndex } = this.state;
    let onboardingComponent = null;
    if (past.length || pastCount) {
      onboardingComponent = getOnboardingComponentFor('deployments-past', { anchor: { left: 240, top: 50 } });
    }

    return (
      <div className="relative">
        <Button
          className="top-right-button"
          color="secondary"
          variant="contained"
          onClick={() => this.setState({ createDialog: true })}
          style={{ position: 'absolute' }}
        >
          Create a deployment
        </Button>
        <Tabs value={tabIndex} onChange={(e, tabIndex) => this._changeTab(tabIndex)} style={{ display: 'inline-block' }}>
          {Object.values(routes).map(route => (
            <Tab component={Link} key={route.route} label={route.title} to={route.route} value={route.route} />
          ))}
        </Tabs>

        {tabIndex === routes.active.route && (
          <div className="margin-top">
            <Pending
              page={this.state.pend_page}
              count={this.state.pendingCount || this.state.pending.length}
              refreshPending={(...args) => this._refreshPending(...args)}
              pending={this.state.pending}
              abort={id => this._abortDeployment(id)}
            />
            <Progress
              page={this.state.prog_page}
              isActiveTab={this.state.currentTab === 'Active'}
              showHelptips={this.state.showHelptips}
              hasDeployments={this.state.hasDeployments}
              devices={this.state.allDevices || []}
              count={this.state.progressCount || this.state.progress.length}
              pendingCount={this.state.pendingCount || this.state.pending.length}
              refreshProgress={(...args) => this._refreshInProgress(...args)}
              abort={id => this._abortDeployment(id)}
              loading={!this.state.doneLoading}
              openReport={rowNum => this._showProgress(rowNum)}
              progress={this.state.progress}
              createClick={() => this.setState({ createDialog: true })}
            />
          </div>
        )}
        {tabIndex === routes.finished.route && (
          <div className="margin-top">
            <Past
              groups={this.state.groups}
              deviceGroup={this.state.groupFilter}
              createClick={() => this.setState({ createDialog: true })}
              pageSize={per_page}
              onChangeRowsPerPage={perPage => self.setState({ per_page: perPage, page: 1 }, () => self._changePastPage())}
              startDate={this.state.startDate}
              endDate={this.state.endDate}
              page={this.state.page}
              isActiveTab={this.state.currentTab === 'Finished'}
              showHelptips={this.state.showHelptips}
              count={pastCount}
              loading={!this.state.doneLoading}
              past={past}
              refreshPast={(...args) => this._changePastPage(...args)}
              showReport={(deployment, type) => this._showReport(deployment, type)}
            />
          </div>
        )}

        <Dialog open={self.state.reportDialog} fullWidth={true} maxWidth="lg">
          <DialogTitle>{self.state.reportType === 'active' ? 'Deployment progress' : 'Results of deployment'}</DialogTitle>
          <DialogContent className={self.state.contentClass} style={{ overflow: 'hidden' }}>
            {dialogContent}
          </DialogContent>
          <DialogActions>{reportActions}</DialogActions>
        </Dialog>

        <CreateDialog
          open={this.state.createDialog}
          onDismiss={() => self.setState({ createDialog: false, device: null })}
          onScheduleSubmit={(...args) => this._onScheduleSubmit(...args)}
          deploymentRelease={release}
          hasDevices={this.state.hasDevices}
          device={this.state.device}
        />
        {onboardingComponent}
      </div>
    );
  }
}
