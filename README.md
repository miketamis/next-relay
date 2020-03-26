This package is for using Relay with NextJS. This is an Alpha Library, use with caution.

This package has three modes, these modes can be mixed, with each page using a different mode:
* Client Side Rendering (CSR) \[Default]
* Server Side Rendering (SSG)
* Static Site Generation (SSG)

# Client Side Rendering
This is the most basic as you don't need to consider how get the data for your build or during server side rendering.
Here you can also just use a standard relay enviroment like the one here https://relay.dev/docs/en/quick-start-guide#relay-environment

```js
import createPageContainer from 'next-relay';
import enviroment from '../standard-relay-enviroment';

function Home({ hello, loading }) {
    if(loading) {
        return <div>Loading</div>;
    }
    return <div>{hello}</div>;
}

const { Page } = createPageContainer(Home, graphql`
  query homeQuery {
    hello
  }
`, {
  initEnviroment: () => enviroment,
});
export default Page;
```

# Mixed modes
Once you have setup SSR/SSG for your initEnviroment, it is backwards compible with CSR, it is recommended to have one initEnivoment in a util file. This library is design with the intent that you will use a mixature of techiques depending on the pages need. https://twitter.com/dan_abramov/status/1193004715044491267?lang=en

# Server Side Rendering
Here we will no longer be able to use a basic enviroment as we dump and move the cache between the server render and the client.
The key thing here is it will give you an instance of RelaySSR, more documentation on that library can be found here: https://github.com/relay-tools/react-relay-network-modern-ssr
```js
import createPageContainer from 'next-relay';

function clientEnviroment(relayClientSSR) {
  return new Environment({
    store: new Store(new RecordSource()),
    network: new RelayNetworkLayer([
      cacheMiddleware({
        size: 100,
        ttl: 60 * 1000,
      }),
      relayClientSSR.getMiddleware({
        lookup: false,
      }),
      urlMiddleware({
        url: () => process.env.GRAPHQL_BASE_URL_CSR,
      }),
    ]),
  });
}

function serverEnviroment(relayServerSSR) {
  return new Environment({
    store: new Store(new RecordSource()),
    network: new RelayNetworkLayer([
      relayServerSSR.getMiddleware(),
      urlMiddleware({
        url: () => process.env.GRAPHQL_BASE_URL_SSR,
      }),
    ]),
  });
}


function Home({ hello, loading }) {
    if(loading) {
        return <div>Loading</div>;
    }
    return <div>{hello}</div>;
}

const { Page } = createPageContainer(Home, graphql`
  query homeQuery {
    hello
  }
`, {
    optimisation: 'SSR',
  initEnviroment: process.browser
  ? clientEnviroment
  : serverEnviroment;
,
});
export default Page;
```


# Static Site Generation
Here we move the rendering to happen during the build phase instead of during runtime, the setup is the exactly the same as SSR except for the fact that you have to export getStaticProps
```js

// Same code as SSR

const { Page, getStaticProps } = createPageContainer(Home, graphql`
  query homeQuery {
    hello
  }
`, {
    optimisation: 'SSG',
  initEnviroment: process.browser
  ? clientEnviroment
  : serverEnviroment;
,
});

export {  Page as default, getStaticProps };
```


