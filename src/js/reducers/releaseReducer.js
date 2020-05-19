import * as ReleaseConstants from '../constants/releaseConstants';

const initialState = {
  /*
   * Return list of saved artifacts objects
   */
  /*
   * return list of artifacts where duplicate names are collated with device compatibility lists combined
   */
  // artifacts: AppStore.getCollatedArtifacts(AppStore.getArtifactsRepo()),
  artifacts: [],
  /*
   * Return list of saved release objects
   */
  byId: {
    /* 
    [releaseName]: {
      Artifacts: [
        {
          id: '',
          name: '',
          description: '',
          device_types_compatible: [],
          ...
          updates: [
            files: [
              { size: 123, name: '' }
            ]
          ],
          url: '' // optional
        }
      ],
      descriptions,
      device_types_compatible,
      Name: ''
    }
    */
  },
  /*
   * Return single release with corresponding Artifacts
   */
  selectedRelease: null,
  selectedArtifact: null,
  showRemoveDialog: false,
  uploading: false,
  uploadProgress: 0
};

const releaseReducer = (state = initialState, action) => {
  switch (action.type) {
    case ReleaseConstants.ARTIFACTS_REMOVED_ARTIFACT:
    case ReleaseConstants.ARTIFACTS_SET_ARTIFACT_URL:
    case ReleaseConstants.UPDATED_ARTIFACT:
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.release.Name]: {
            ...state.byId[action.release.Name],
            ...action.release
          }
        }
      };
    case ReleaseConstants.RECEIVE_RELEASES: {
      return {
        ...state,
        byId: action.releases
      };
    }
    case ReleaseConstants.RECEIVE_RELEASE:
      return {
        ...state,
        byId: {
          [action.release.Name]: {
            ...state.byId[action.release.Name],
            ...action.release
          }
        }
      };
    case ReleaseConstants.RELEASE_REMOVED: {
      let byId = state.byId;
      delete byId[action.release];

      return {
        ...state,
        byId,
        selectedRelease: action.release === state.selectedRelease ? Object.keys(byId)[0] : state.selectedRelease
      };
    }
    case ReleaseConstants.SELECTED_ARTIFACT:
      return {
        ...state,
        selectedArtifact: action.artifact
      };
    case ReleaseConstants.SHOW_REMOVE_DIALOG:
      return {
        ...state,
        showRemoveDialog: action.showRemoveDialog
      };
    case ReleaseConstants.SELECTED_RELEASE:
      return {
        ...state,
        selectedRelease: action.release
      };
    case ReleaseConstants.UPLOAD_ARTIFACT:
      return state;
    case ReleaseConstants.UPLOAD_PROGRESS:
      return {
        ...state,
        uploading: action.inprogress || state.inprogress,
        uploadProgress: action.uploadProgress
      };

    default:
      return state;
  }
};

export default releaseReducer;
