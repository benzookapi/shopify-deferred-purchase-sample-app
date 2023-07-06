import { useState, useEffect, useCallback } from 'react';
import { useAppBridge } from '@shopify/app-bridge-react';
import { authenticatedFetch } from "@shopify/app-bridge-utils";
import { Redirect } from '@shopify/app-bridge/actions';
import { getSessionToken } from "@shopify/app-bridge-utils";
import { Page, Card, Layout, Stack, Link, Badge, Text, Spinner, Banner, Button, VerticalStack, Checkbox } from '@shopify/polaris';
import { CircleRightMajor } from '@shopify/polaris-icons';

import { _getParamValueFromQuery } from "../utils/my_util";

// Subscription contract admin link
// See https://shopify.dev/docs/apps/selling-strategies/subscriptions/contracts/create
function Subscriptions() {
    const app = useAppBridge();

    const id = _getParamValueFromQuery(window, 'id');

    const [res, setRes] = useState({});
    const [resBilling, setResBilling] = useState({ "message": "", "response": {} });

    const [fulfill, setFulfill] = useState(false);
    const fulfillChange = useCallback((newFulfill) => setFulfill(newFulfill), []);

    const [rawURL, setRawUrl] = useState('');
    const [authHeader, setAuthHeader] = useState('');

    const getDetails = () => {
        setRes({});
        authenticatedFetch(app)(`/subscriptions?&id=${id}`).then((response) => {
            response.json().then((json) => {
                console.log(JSON.stringify(json, null, 4));
                setRes(json.result);
            }).catch((e) => {
                console.log(`${e}`);
            });
        });
    };

    useEffect(getDetails, []);

    return (
        <Page title="Selected selling contract details">
            <Layout>
                <Layout.Section>
                    <Link url="https://shopify.dev/docs/apps/selling-strategies/subscriptions/contracts/create" external={true}>Dev. doc</Link>
                </Layout.Section>
                <Layout.Section>
                    <Stack spacing="loose">
                        <Text as='h2'>Contract id:</Text>
                        <Badge status='info'>{id}</Badge>
                    </Stack>
                </Layout.Section>
                <Layout.Section>
                    <Card>
                        <APIResult res={res} />
                    </Card>
                </Layout.Section>
                <Layout.Section>
                    <Text variant="heading2xl" as="h3">Create the next order with a billing attempt</Text>
                    <Text>
                        For more advanced fullfilment management, refer to <Link url="https://shopify.dev/docs/apps/selling-strategies/subscriptions/fulfillments" external={true}>Dev. doc</Link>
                    </Text>
                </Layout.Section>
                <Layout.Section>
                    <Card>
                        <VerticalStack align="space-around">
                            <div>&nbsp;</div>
                            <div>
                                <span>&nbsp;</span>
                                <Checkbox
                                    label="Fulfill automatically by API (with dummy tracking number and carrier)"
                                    checked={fulfill}
                                    onChange={fulfillChange} />
                            </div>
                            <div>
                                <span>&nbsp;</span>
                                <Button primary onClick={() => {
                                    setResBilling({});
                                    // See https://shopify.dev/docs/apps/selling-strategies/subscriptions/contracts/create#example-call
                                    authenticatedFetch(app)(`/subscriptions?billing=true&id=${id}&fulfill=${fulfill}`).then((response) => {
                                        response.json().then((json) => {
                                            console.log(JSON.stringify(json, null, 4));
                                            setResBilling(json.result);
                                            getDetails();
                                            setRawUrl(`GET: https://${window.location.hostname}/subscriptions?billing=true&id=${id}&fulfill=${fulfill}`);
                                            getSessionToken(app).then((sessionToken) => {
                                                setAuthHeader(`with the HTTP header, authorization: Bearer ${sessionToken}`);
                                            });
                                        }).catch((e) => {
                                            console.log(`${e}`);
                                        });
                                    });
                                }}>
                                    Make a billing attempt &#128176;
                                </Button>
                            </div>
                            <div>
                                <APIResult res={resBilling} />
                            </div>
                            <div>
                                <Banner
                                    title="Note that this process have to be done automatically in a batch or other reccuring system."
                                    status="info"
                                >
                                    <p>Billing attempt execution need to follow the definitions of contract and plan above.</p>
                                    <p>&nbsp;</p>
                                    <p>The URL to make orders recurrisviely for this cotract is:</p>
                                    <p>{rawURL}</p>
                                    <p>{authHeader}</p>
                                </Banner>
                            </div>
                            <div>&nbsp;</div>
                        </VerticalStack>
                    </Card>
                </Layout.Section>
            </Layout>
        </Page>
    );
}

function APIResult(props) {
    if (Object.keys(props.res).length === 0) {
        return <Spinner accessibilityLabel="Calling Order GraphQL" size="large" />;
    }
    return (<pre>{JSON.stringify(props.res, null, 4)}</pre>);
}

export default Subscriptions