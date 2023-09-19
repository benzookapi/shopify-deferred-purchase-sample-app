import { useState, useCallback, useEffect } from 'react';
import {
  render,
  extend,
  useExtensionApi,
  useData,
  useSessionToken,
  useContainer,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Radio,
  TextBlock,
  TextField,
  Button,
  Banner,
  Link
} from '@shopify/admin-ui-extensions-react';

// Your extension must render all four modes
extend(
  'Admin::Product::SubscriptionPlan::Add',
  render(() => <App />),
);
extend(
  'Admin::Product::SubscriptionPlan::Create',
  render(() => <Create />),
);
extend(
  'Admin::Product::SubscriptionPlan::Remove',
  render(() => <App />),
);
extend(
  'Admin::Product::SubscriptionPlan::Edit',
  render(() => <App />),
);

// *NOTE THAT The raw app url as the backend is not configurable unlike other extensions
//const APP_URL = `YOUR_APP_URL_IN_APP_SETTINGS (https://xxxxxxx without the last slash '/')`;
const APP_URL = `https://shopify-deferred-purchase-sample-app.onrender.com`;

// See https://shopify.dev/docs/apps/selling-strategies/purchase-options/app-extensions/extension-points#product-details-page
// See https://shopify.dev/docs/api/product-subscription-extensions/components
function App() {
  const { extensionPoint } = useExtensionApi();
  const data = useData();
  const { getSessionToken } = useSessionToken();
  const { close, done } = useContainer();

  console.log(`data: ${JSON.stringify(data)}`);

  const [res, setRes] = useState({});

  if (extensionPoint.indexOf('Edit') != -1) {
    useEffect(() => {
      getSessionToken().then((token) => {
        const url = `${APP_URL}/plans?group_id=${data.sellingPlanGroupId}`;
        console.log(`Accessing... ${url}`);
        fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }).then(res => {
          res.json().then(json => {
            console.log(`json: ${JSON.stringify(json)}`);
            setRes(json);
          }).catch(e => {
            console.log(`${e}`);
          });
        }).catch(e => {
          console.log(`error: ${e}`);
        });
      });
    }, []);
  }

  return (
    <BlockStack>
      <TextBlock>Welcome to the {extensionPoint} extension!</TextBlock>
      <TextBlock>For selling plan Add / Edit / Remove, refer to <Link external="true" url="https://shopify.dev/docs/apps/selling-strategies/purchase-options/deferred/deferred-purchase-options">
        Shopify dev. site tutorials</Link> to integrate them.</TextBlock>
      <TextBlock>This page is buit with <Link external="true" url="https://shopify.dev/docs/api/admin-extensions/components">
        Components for Admin UI Extensions</Link>.</TextBlock>
      <TextBlock variation="strong">Your selected data</TextBlock>
      <InlineStack spacing="loose">
        <Text appearance="subdued" strong>Product:</Text><Text appearance="code">{data.productId}</Text>
      </InlineStack>
      <InlineStack spacing="loose">
        <Text appearance="subdued" emphasized>Variant:</Text><Text appearance="code">{data.variantId}</Text>
      </InlineStack>
      <InlineStack spacing="loose">
        <Text appearance="subdued" strong>Selling Plan Group:</Text><Text appearance="code">{data.sellingPlanGroupId}</Text>
      </InlineStack>
      <InlineStack spacing="loose">
        <Text appearance="subdued" emphasized>Variants:</Text><Text appearance="code">{data.variantIds}</Text>
      </InlineStack>
      <TextBlock variation="strong">Your selected data details</TextBlock>
      <InlineStack spacing="loose">
        <TextBlock>{JSON.stringify(res, null, 4)}</TextBlock>
      </InlineStack>
    </BlockStack>
  );
}

// See https://shopify.dev/docs/apps/selling-strategies/purchase-options/app-extensions
// See https://shopify.dev/docs/api/admin-extensions
function Create() {
  const { extensionPoint } = useExtensionApi();
  const data = useData();
  const { getSessionToken } = useSessionToken();
  const { close, done } = useContainer();

  console.log(`data: ${JSON.stringify(data)}`);

  const [category, setCategory] = useState('PRE_ORDER');
  const categoryChange = useCallback((newCategory) => setCategory(newCategory), []);
  const [title, setTitle] = useState('');
  const titleChange = useCallback((newTitle) => setTitle(newTitle), []);
  const [days, setDays] = useState(14);
  const daysChange = useCallback((newDays) => setDays(newDays), []);
  const [percentage, setPercentage] = useState(20);
  const percentageChange = useCallback((newPercentage) => setPercentage(newPercentage), []);

  return (
    <BlockStack>
      <TextBlock>Welcome to the {extensionPoint} extension!</TextBlock>
      <TextBlock>This page is buit with <Link external="true" url="https://shopify.dev/docs/api/admin-extensions/components">
        Components for Admin UI Extensions</Link>.</TextBlock>
      <Banner
        status="info"
        title="Creat a deferred purchase option"
      >
      </Banner>
      <Card title="Your selected data" sectioned="true">
        <InlineStack spacing="loose">
          <Text appearance="subdued" strong>Product:</Text><Text appearance="code">{data.productId}</Text>
        </InlineStack>
        <InlineStack spacing="loose">
          <Text appearance="subdued" emphasized>Variant:</Text><Text appearance="code">{data.variantId}</Text>
        </InlineStack>
      </Card>
      <Card title="Input your deferred purchase option details" sectioned="true">
        <InlineStack spacing="loose">
          <Radio
            label="Pre-order"
            helpText="Charge some at checkout and the rest of amount days later"
            checked={category === 'PRE_ORDER'}
            id="preorder"
            name="category"
            value="PRE_ORDER"
            onChange={categoryChange}
          />
          <Radio
            label="TBYB (Try-before-you-buy)"
            helpText="Charge zero at checkout and the full amount days later"
            checked={category === 'TRY_BEFORE_YOU_BUY'}
            id="tbyb"
            name="category"
            value="TRY_BEFORE_YOU_BUY"
            onChange={categoryChange}
          />
        </InlineStack>
        <InlineStack spacing="loose">
          <TextField
            type="text"
            label="Plan name"
            value={title}
            onChange={titleChange}
          />
        </InlineStack>
        <InlineStack spacing="loose">
          <TextField
            type="number"
            label="How many days later you charge"
            value={days}
            onChange={daysChange}
          />
        </InlineStack>
        <InlineStack spacing="loose">
          <TextField
            type="number"
            label="Deposit percentage (for Pre-order only)"
            value={percentage}
            onChange={percentageChange}
          />
        </InlineStack>
        <InlineStack spacing="loose" inlineAlignment="trailing">
          <Button title="Cancel" onPress={() => { close(); }}></Button>
          <Button kind="primary" title="Create a plan" onPress={() => {
            getSessionToken().then((token) => {
              const url = `${APP_URL}/plans?event=create&product_id=${data.productId}&variant_id=${typeof data.variantId === 'undefined' ? '' : data.variantId}&category=${category}&title=${title}&days=${days}&percentage=${percentage}`;
              console.log(`Accessing... ${url}`);
              fetch(url, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }).then(res => {
                res.json().then(json => {
                  console.log(`json: ${JSON.stringify(json)}`);
                  done();
                }).catch(e => {
                  console.log(`${e}`);
                });
              }).catch(e => {
                console.log(`error: ${e}`);
              });
            });
          }}></Button>
        </InlineStack>
      </Card>
    </BlockStack>
  );

}