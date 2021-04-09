//@flow
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useQuery } from 'react-query';

import type { RootState } from './ducks/reducer';
import { coreV1 } from './services/k8s/api';

/**
 * It brings automatic strong typing to native useSelector by anotating state with RootState.
 * It should be used instead of useSelector to benefit from RootState typing
 */
export const useTypedSelector: <TSelected>(
  selector: (state: RootState) => TSelected,
  equalityFn?: (left: TSelected, right: TSelected) => boolean,
) => TSelected = useSelector;

/**
 * It retrieves the nodes data through react-queries
 */
export const useNodes = (): Object[] => {
  const [nodes, setNodes] = useState([]);

  const nodesQuery = useQuery(['nodesNames'], () =>
    coreV1.listNode().then((res) => {
      if (res.response.statusCode === 200 && res.body?.items) {
        // Extracting useful data (IP, name, ...) to top level for ease of use
        return res.body?.items.map((item) =>
          Object.assign({}, item, {
            internalIP: item?.status?.addresses?.find(
              (ip) => ip.type === 'InternalIP',
            ).address,
            name: item?.metadata?.name,
          }),
        );
      }
      return null;
    }),
  );

  useEffect(() => {
    if (!nodesQuery.isLoading && nodesQuery.isSuccess) {
      setNodes(nodesQuery.data);
    }
  }, [nodesQuery]);

  return nodes;
};
