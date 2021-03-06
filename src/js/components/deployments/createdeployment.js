import React from 'react';
import { connect } from 'react-redux';
import moment from 'moment';

import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Step, StepLabel, Stepper } from '@material-ui/core';

import SoftwareDevices from './deployment-wizard/softwaredevices';
import ScheduleRollout from './deployment-wizard/schedulerollout';
import Review from './deployment-wizard/review';

import { createDeployment } from '../../actions/deploymentActions';
import { selectDevice } from '../../actions/deviceActions';
import { selectRelease } from '../../actions/releaseActions';
import { advanceOnboarding } from '../../actions/onboardingActions';
import { saveGlobalSettings } from '../../actions/userActions';
import { UNGROUPED_GROUP } from '../../constants/deviceConstants';
import { onboardingSteps } from '../../constants/onboardingConstants';
import { getIsEnterprise, getOnboardingState } from '../../selectors';

import Tracking from '../../tracking';
import { deepCompare, standardizePhases, validatePhases } from '../../helpers';

export const allDevices = 'All devices';
const MAX_PREVIOUS_PHASES_COUNT = 5;

const deploymentSteps = [
  { title: 'Select target software and devices', closed: false, component: SoftwareDevices },
  { title: 'Set a rollout schedule', closed: true, component: ScheduleRollout },
  { title: 'Review and create', closed: false, component: Review }
];

export const getPhaseStartTime = (phases, index, startDate) => {
  if (index < 1) {
    return startDate.toISOString ? startDate.toISOString() : startDate;
  }
  // since we don't want to get stale phase start times when the creation dialog is open for a long time
  // we have to ensure start times are based on delay from previous phases
  // since there likely won't be 1000s of phases this should still be fine to recalculate
  const newStartTime = phases.slice(0, index).reduce((accu, phase) => moment(accu).add(phase.delay, phase.delayUnit), startDate);
  return newStartTime.toISOString();
};

export class CreateDialog extends React.Component {
  constructor(props, context) {
    super(props, context);
    this.state = {
      activeStep: 0,
      deploymentDeviceIds: [],
      steps: deploymentSteps,
      retries: props.retries
    };
  }

  componentDidMount() {
    const { deploymentObject, isEnterprise, isHosted, plan, selectDevice } = this.props;
    if (Object.keys(deploymentObject).length) {
      this.setState({ ...deploymentObject });
      if (deploymentObject.deploymentDeviceIds.length === 1 && deploymentObject.deploymentDeviceIds[0] === deploymentObject.group) {
        selectDevice(deploymentObject.deploymentDeviceIds[0]);
      }
    }
    const steps = deploymentSteps.reduce((accu, step) => {
      if (step.closed && ((!isEnterprise && plan === 'os') || !(isHosted || isEnterprise))) {
        return accu;
      }
      accu.push(step);
      return accu;
    }, []);
    this.setState({ steps });
  }

  componentDidUpdate(prevProps) {
    // Update state if single device passed from props
    if (prevProps.device !== this.props.device && this.props.device) {
      this.setState({ deploymentDeviceIds: [this.props.device.id] });
    }
  }

  setDeploymentSettings(value, property) {
    this.setState({ [property]: value });
  }

  cleanUpDeploymentsStatus() {
    this.props.selectDevice();
    this.props.selectRelease();
    const location = window.location.hash.substring(0, window.location.hash.indexOf('?'));
    return location.length ? window.location.replace(location) : null; // lgtm [js/client-side-unvalidated-url-redirection]
  }

  onSaveRetriesSetting(hasNewRetryDefault) {
    this.setState({ hasNewRetryDefault });
  }

  closeWizard() {
    this.cleanUpDeploymentsStatus();
    this.props.onDismiss();
  }

  onScheduleSubmit(settings) {
    const self = this;
    const { hasNewRetryDefault } = self.state;
    const { advanceOnboarding, createDeployment, globalSettings, isOnboardingComplete, onScheduleSubmit, saveGlobalSettings } = self.props;
    const { deploymentDeviceIds, device, filterId, group, phases, release, retries } = settings;
    const startTime = phases?.length ? phases[0].start_ts || new Date() : new Date();
    const newDeployment = {
      artifact_name: release.Name,
      devices: filterId || (group && group !== allDevices && !device) ? undefined : deploymentDeviceIds,
      filter_id: filterId,
      all_devices: !filterId && group === allDevices,
      group: group === allDevices || device ? undefined : group,
      name: device?.id || (group ? decodeURIComponent(group) : 'All devices'),
      phases: phases
        ? phases.map((phase, i, origPhases) => {
            phase.start_ts = getPhaseStartTime(origPhases, i, startTime);
            return phase;
          })
        : phases,
      retries
    };
    if (!isOnboardingComplete) {
      advanceOnboarding(onboardingSteps.SCHEDULING_RELEASE_TO_DEVICES);
    }
    return createDeployment(newDeployment).then(() => {
      let newSettings = { retries: hasNewRetryDefault ? retries : globalSettings.retries };
      if (phases) {
        const standardPhases = standardizePhases(phases);
        let previousPhases = globalSettings.previousPhases || [];
        previousPhases = previousPhases.map(standardizePhases);
        if (!previousPhases.find(previousPhaseList => previousPhaseList.every(oldPhase => standardPhases.find(phase => deepCompare(phase, oldPhase))))) {
          previousPhases.push(standardPhases);
        }
        newSettings.previousPhases = previousPhases.slice(-1 * MAX_PREVIOUS_PHASES_COUNT);
      }
      saveGlobalSettings(newSettings);
      // track in GA
      Tracking.event({ category: 'deployments', action: 'create' });
      // successfully retrieved new deployment
      self.cleanUpDeploymentsStatus();
      onScheduleSubmit();
    });
  }

  render() {
    const self = this;
    const { device, deploymentObject, groups, release } = self.props;
    const { activeStep, deploymentDeviceIds, deploymentDeviceCount, group, phases, retries, steps } = self.state;
    const ComponentToShow = steps[activeStep].component;
    const deploymentSettings = {
      deploymentDeviceIds: deploymentObject.deploymentDeviceIds || deploymentDeviceIds,
      deploymentDeviceCount: deploymentObject.deploymentDeviceCount || deploymentDeviceCount,
      filterId: groups[deploymentObject.group || group] ? groups[deploymentObject.group || group].id : undefined,
      device,
      group: deploymentObject.group || group,
      phases,
      release: deploymentObject.release || release || self.state.release,
      retries: deploymentObject.retries || retries
    };
    const disableSchedule = !validatePhases(phases, deploymentSettings.deploymentDeviceCount, deploymentSettings.filterId);
    const disabled =
      activeStep === 0
        ? !(
            deploymentSettings.release &&
            (deploymentSettings.deploymentDeviceCount || deploymentSettings.filterId || (deploymentSettings.group && deploymentSettings.group !== allDevices))
          )
        : disableSchedule;
    const finalStep = activeStep === steps.length - 1;
    return (
      <Dialog open={true} fullWidth={false} maxWidth="md">
        <DialogTitle>Create a deployment</DialogTitle>
        <DialogContent className="dialog">
          <Stepper activeStep={activeStep} alternativeLabel style={{ minWidth: '500px' }}>
            {steps.map(step => (
              <Step key={step.title}>
                <StepLabel>{step.title}</StepLabel>
              </Step>
            ))}
          </Stepper>
          <ComponentToShow
            deploymentAnchor={this.deploymentRef}
            filters={deploymentSettings.filterId ? groups[deploymentObject.group || group].filters : undefined}
            {...self.props}
            {...self.state}
            {...deploymentSettings}
            setDeploymentSettings={(...args) => self.setDeploymentSettings(...args)}
            onSaveRetriesSetting={shouldSave => self.onSaveRetriesSetting(shouldSave)}
          />
        </DialogContent>
        <DialogActions className="margin-left margin-right">
          <Button key="schedule-action-button-1" onClick={() => self.closeWizard()} style={{ marginRight: '10px', display: 'inline-block' }}>
            Cancel
          </Button>
          <Button disabled={activeStep === 0} onClick={() => self.setState({ activeStep: activeStep - 1 })}>
            Back
          </Button>
          <div style={{ flexGrow: 1 }} />
          <Button
            variant="contained"
            color="primary"
            buttonRef={ref => (this.deploymentRef = ref)}
            disabled={disabled}
            onClick={finalStep ? () => self.onScheduleSubmit(deploymentSettings) : () => self.setState({ activeStep: activeStep + 1 })}
          >
            {finalStep ? 'Create' : 'Next'}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
}

const actionCreators = { advanceOnboarding, createDeployment, saveGlobalSettings, selectDevice, selectRelease };

export const mapStateToProps = state => {
  const { plan = 'os' } = state.organization.organization;
  // eslint-disable-next-line no-unused-vars
  const { [UNGROUPED_GROUP.id]: ungrouped, ...groups } = state.devices.groups.byId;
  return {
    acceptedDeviceCount: state.devices.byStatus.accepted.total,
    createdGroup: Object.values(state.devices.groups.byId)[1],
    device: state.devices.selectedDevice ? state.devices.byId[state.devices.selectedDevice] : null,
    globalSettings: state.users.globalSettings,
    groups,
    hasDevices: state.devices.byStatus.accepted.total || state.devices.byStatus.accepted.deviceIds.length > 0,
    hasDynamicGroups: Object.values(groups).some(group => !!group.id),
    hasPending: state.devices.byStatus.pending.total,
    isEnterprise: getIsEnterprise(state),
    isHosted: state.app.features.isHosted,
    isOnboardingComplete: state.onboarding.complete,
    onboardingState: getOnboardingState(state),
    plan,
    previousPhases: state.users.globalSettings.previousPhases,
    previousRetries: state.users.globalSettings.previousRetries || 0,
    release: state.releases.selectedRelease ? state.releases.byId[state.releases.selectedRelease] : null,
    releases: Object.values(state.releases.byId),
    retries: state.users.globalSettings.retries,
    selectedDevice: state.devices.selectedDevice,
    selectedGroup: state.devices.groups.selectedGroup,
    selectedRelease: state.releases.selectedRelease
  };
};

export default connect(mapStateToProps, actionCreators)(CreateDialog);
