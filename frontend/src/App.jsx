import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Provider, NavigationMenu, TitleBar } from '@shopify/app-bridge-react';
import { AppProvider } from '@shopify/polaris';

// See https://www.npmjs.com/package/@shopify/polaris
import '@shopify/polaris/build/esm/styles.css';

// See https://www.npmjs.com/package/@shopify/react-i18n 
//import translations from "@shopify/polaris/locales/en.json";

import Index from './pages/Index';
import Subscriptions from "./pages/Subscriptions";

import { _getAdminFromShop, _getShopFromQuery } from "./utils/my_util";

// See https://shopify.dev/apps/tools/app-bridge/getting-started/app-setup
const config = {
  apiKey: API_KEY, // See ../vite.config.js
  host: new URLSearchParams(window.location.search).get("host"),
  forceRedirect: true
  // If false, the page accessed outside admin keeps the location where App Bridge doesn't work.
  // See https://shopify.dev/apps/tools/app-bridge/getting-started/app-setup#initialize-shopify-app-bridge-in-your-app
};

// If the page is accessed directly outside the admin unembedded, shop is used for the host.
// See https://shopify.dev/apps/auth/oauth/getting-started#step-6-redirect-to-your-apps-ui
if (config.host == null) {
  console.log(`The config.host is null, being set from 'shop'.`);
  config.host = window.btoa(_getAdminFromShop(_getShopFromQuery(window))).replace(/=/g, '');
}

console.log(`AppBrige settings: config.apiKey [${config.apiKey}] config.host [${config.host}] config.forceRedirect [${config.forceRedirect}]`);

// All Polaris compoments which you can copy the React snipets from. https://polaris.shopify.com/components
// AppProvider is the base layout compoment. https://polaris.shopify.com/components/app-provider
// See https://shopify.dev/apps/tools/app-bridge/getting-started/using-react
// See https://polaris.shopify.com/components/app-provider 
function App() {
  return (
    <Provider config={config}>
      <NavigationMenu
        navigationLinks={[
          
        ]}
        matcher={(link, location) => link.destination === location.pathname}
      />
      <TitleBar
        title="Welcome to my subscription app &#9996;"
        breadcrumbs={[{ content: "Index", url: '/', target: "APP" }]}
        primaryAction={{ content: 'Code on GitHub', url: 'https://github.com/benzookapi/shopify-subscription-sample-app', target: "REMOTE", external: true }}
        secondaryActions={[{ content: 'Dev. site', url: 'https://shopify.dev/docs/apps/selling-strategies/subscriptions/modeling', target: "REMOTE", external: true }]}
        actionGroups={[{ title: 'Shopify JP Blog', actions: [{ content: 'How to build apps / themes', url: 'https://www.shopify.com/jp/blog/partner-shopify-app-development', target: "REMOTE", external: true }] }]}
      />
      {/* Replacing <AppProvider i18n={translations}> for my own use case. */}
      <AppProvider i18n={{
        Polaris: {
          ResourceList: {
            showing: 'Sample Code Index',
          },
        },
      }}>
        {/* <Routes> needs to be inside <AppProvider> */}
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
          </Routes>
        </BrowserRouter>
        {/* Each page content comes here */}
      </AppProvider>
    </Provider>
  );
}

export default App