import React from 'react';
import { QueryRenderer } from 'react-relay';
import { GetStaticProps } from 'next';
import { fetchQuery, Network, Environment, RecordSource, Store } from 'relay-runtime';
import stableCopy from 'relay-runtime/lib/util/stableCopy';
import RelayServerSSR from 'react-relay-network-modern-ssr/node8/server';
import RelayClientSSR from 'react-relay-network-modern-ssr/node8/client';
import 'isomorphic-fetch';
import "regenerator-runtime/runtime.js";

// https://github.com/facebook/relay/blob/78d20cc8cdeb8328d2922d840dc76aa51eb1ddd6/packages/relay-runtime/network/RelayQueryResponseCache.js#L99
function getCacheKey(queryID, variables) {
  return JSON.stringify(stableCopy({ queryID, variables }));
}

function createPendingPromise() {
  return new Promise(() => {})
}

async function fetchQueryAndDumpCache(query, variables, initEnviroment) {
  if (!initEnviroment) {
    throw Error('Cannot fetch and dump without a server enviroment');
  }
  const relayServerSSR = new RelayServerSSR();

  const environment = initEnviroment(relayServerSSR);

  await fetchQuery(environment, query, variables);

  return JSON.parse(JSON.stringify(await relayServerSSR.getCache()));
}

function createEnvironmentFromDumpedCache(dumpedCache, initEnviroment) {
  if (process.browser) {
    return initEnviroment(new RelayClientSSR(dumpedCache));
  }

  const source = new RecordSource();
  const store = new Store(source);

  return new Environment({
    store,
    network: Network.create((query, variables) => {
      const queryID = query.name;
      const key = getCacheKey(queryID, variables);
      const cacheEntry = dumpedCache.find(([dataKey]) => dataKey === key);
      if (!cacheEntry) {
        return createPendingPromise();
      }
      return cacheEntry[1];
    }),
  });
}

export const Context = React.createContext(null);

function renderPage(Component, query, options: Options) {
  const { variables, optimisation, initEnviroment } = options;

  return ({ dumpedCache, getStaticPropsCalled }) => {
    if (!getStaticPropsCalled && optimisation === 'SSG') {
      throw new Error('getStaticProps is not being exported from this page');
    }
    const environment = createEnvironmentFromDumpedCache(
      optimisation === 'CSR' ? [] : dumpedCache,
      initEnviroment,
    );
    return (
      <Context.Provider value={environment}>
        <QueryRenderer
          query={query}
          variables={variables}
          environment={environment}
          render={({ error, props }) => {
            if (error) {
              return <div>{error.message}</div>;
            }
            const key = getCacheKey(query.params.name, variables);

            if (props) {
              // eslint-disable-next-line react/jsx-props-no-spreading
              return <Component loading={false} {...props} key={key} />;
            }
            return <Component loading={true} key={`loading${key}`} />;
          }}
        />
      </Context.Provider>
    );
  };
}

type Options = {
  variables?: {};
  optimisation: 'SSG' | 'CSR' | 'SSR';
  initEnviroment?: () => Environment;
};

function createPageContainer(
  Component,
  query,
  options: Options = { optimisation: 'CSR' },
) {
  const { variables, optimisation, initEnviroment } = options;

  if (optimisation === 'SSR') {
    throw new Error('SSR rendering not supported yet');
  }

  const getStaticProps: GetStaticProps = async () => {
    if (optimisation !== 'SSG') {
      throw new Error(
        'getStaticProps can only be used with SSG optimisation on',
      );
    }
    const dumpedCache = await fetchQueryAndDumpCache(
      query,
      variables,
      initEnviroment,
    );
    return {
      props: {
        dumpedCache,
        getStaticPropsCalled: true,
      },
    };
  };

  return {
    Page: renderPage(Component, query, options),
    getStaticProps,
  };
}

export default createPageContainer;
