import { useAppBridge } from '@shopify/app-bridge-react';
import { Page, VerticalStack, Card, Layout, Text, Link, Badge, FooterHelp } from '@shopify/polaris';

import { _getAdminFromShop, _getShopFromQuery } from "../utils/my_util";

// Index page for this subscription app setup
function Index() {
    const app = useAppBridge();

    const shop = _getShopFromQuery(window);

    return (
        <>
            <Page title="How to try this app subscription">
                <VerticalStack gap="3">
                    <Card padding="4">
                        <Layout>
                            <Layout.Section>
                                <Text as="h2" fontWeight="bold">Step 1. Create your plans for products</Text>
                            </Layout.Section>
                            <Layout.Section>
                                Go to <Link url={`https://${_getAdminFromShop(shop)}/products`} external={true}>Products</Link> and make your <Link url={`https://shopify.dev/docs/apps/selling-strategies/subscriptions/modeling#plan-setup`} external={true}>selling plans</Link> at <Badge status="info">[Purchase options] &gt; [Create a new option] in each product details</Badge> built as <Link url={`https://github.com/benzookapi/shopify-subscription-sample-app/blob/main/extensions/my-subscription-ext/src/index.jsx`} external={true}>Admin UI extension</Link>.
                            </Layout.Section>
                        </Layout>
                    </Card>
                    <Card padding="4">
                        <Layout>
                            <Layout.Section>
                                <Text as="h2" fontWeight="bold">Step 2. Insert your plan selector into the product detail page</Text>
                            </Layout.Section>
                            <Layout.Section>
                                Go to <Badge status="info"><Link url={`https://${shop}/admin/themes/current/editor?template=product&addAppBlockId=${SHOPIFY_CONTRACT_EXT_ID}%2Fapp-block&target=newAppsSection`} external={true}>Product detail page editor with this app block</Link></Badge> to enable the plan selector built as <Link url={`https://github.com/benzookapi/shopify-subscription-sample-app/blob/main/extensions/my-theme-contract-ext/blocks/app-block.liquid`} external={true}>Theme app extension</Link>.
                            </Layout.Section>
                        </Layout>
                    </Card>
                    <Card padding="4">
                        <Layout>
                            <Layout.Section>
                                <Text as="h2" fontWeight="bold">Step 3. Insert your customer portal (my page) into the customer login and account page</Text>
                            </Layout.Section>
                            <Layout.Section>
                                Go to <Badge status="info"><Link url={`https://${shop}/admin/themes/current/editor?template=customers%2Flogin&addAppBlockId=${SHOPIFY_CONTRACT_EXT_ID}%2Fmypage-block&target=newAppsSection`} external={true}>Customer page editor with this app block</Link></Badge> to enable the portal link built as <Link url={`https://github.com/benzookapi/shopify-subscription-sample-app/blob/main/extensions/my-theme-contract-ext/blocks/mypage-block.liquid`} external={true}>Theme app extension</Link>.
                            </Layout.Section>
                            <Layout.Section>
                                If you can't access to the customer account / order page in the editor, login from the customer login page first within the editor.
                            </Layout.Section>
                            <Layout.Section>
                                Also, check if <Link url={`https://${shop}/apps/mysubpage`} external={true}>your app proxy url</Link> works fine with a JSON response which provides the customer page under the shop domain.
                            </Layout.Section>
                        </Layout>
                    </Card>
                    <Card padding="4">
                        <Layout>
                            <Layout.Section>
                                <Text as="h2" fontWeight="bold">Step 4. Make your first order through the checkout to create the following ones as subscription</Text>
                            </Layout.Section>
                            <Layout.Section>
                                Go to <Link url={`https://${shop}`} external={true}>your online store</Link> to select the products with selling plans above chosen to checkout. In <Link url={`https://${_getAdminFromShop(shop)}/orders`} external={true}>Orders</Link>, you will see the latest order you made with <Badge status="info"><Link url={`https://shopify.dev/docs/apps/selling-strategies/subscriptions/contracts/create`} external={true}>your selling cotract links</Link></Badge>.
                            </Layout.Section>
                            <Layout.Section>
                                In the selling contract page linked above, you can see the contract details and make the next order with <Badge status="info">[Make a billing attempt]</Badge>. If the fulfillment checkbox selected, <Link url={`https://shopify.dev/docs/api/admin-graphql/2023-04/mutations/fulfillmentCreateV2`} external={true}>the fulfillment gets done automatically</Link> after the new order gets created.
                            </Layout.Section>
                            <Layout.Section>
                                In <Link url={`https://${_getAdminFromShop(shop)}/orders`} external={true}>Orders</Link> again, you will see the 2nd, 3rd, ... orders made by billing attempts to know how you should handle recursive process as real subscription based on customer's contracts.
                            </Layout.Section>
                        </Layout>
                    </Card>
                    <Card padding="4">
                        <Layout>
                            <Layout.Section>
                                <Text as="h2" fontWeight="bold">Step 5. Check customer's portal to update their payment methods</Text>
                            </Layout.Section>
                            <Layout.Section>
                                Go to <Link url={`https://${shop}/account/login`} external={true}>your online store login page</Link> to access to the customer contract details through <Link url={`https://shopify.dev/docs/apps/selling-strategies/purchase-options/customer-portal`} external={true}>the app proxy portal</Link>.
                            </Layout.Section>
                            <Layout.Section>
                                <Badge status="info">[Send an email to update my payment method]</Badge> at the portal page accessed from the link generated above, <Link url={`https://shopify.dev/docs/apps/selling-strategies/purchase-options/customer-portal/create-customer-portal`} external={true}>sends an email to the customer address or update directly (this has some limitations)</Link> with the checkout link to update their payment method.
                            </Layout.Section>
                        </Layout>
                    </Card>
                </VerticalStack>
            </Page>
            <FooterHelp>
                &nbsp;
            </FooterHelp>
        </>
    );
}

export default Index