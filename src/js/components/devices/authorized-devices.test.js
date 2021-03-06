import React from 'react';
import renderer from 'react-test-renderer';
import { Provider } from 'react-redux';
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import Authorized from './authorized-devices';
import { defaultState, undefineds } from '../../../../tests/mockData';

const mockStore = configureStore([thunk]);

describe('AuthorizedDevices Component', () => {
  let store;
  beforeEach(() => {
    store = mockStore({
      ...defaultState,
      devices: {
        ...defaultState.devices,
        byStatus: {
          ...defaultState.devices.byStatus,
          accepted: {
            deviceIds: [],
            total: 0
          }
        }
      }
    });
  });

  it('renders correctly', async () => {
    const tree = renderer
      .create(
        <Provider store={store}>
          <Authorized onFilterChange={jest.fn} />
        </Provider>
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
    expect(JSON.stringify(tree)).toEqual(expect.not.stringMatching(undefineds));
  });
});
