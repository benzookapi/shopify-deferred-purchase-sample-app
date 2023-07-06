const mysub_send = function (shop_url) {
    const url = `${shop_url}/apps/mysubpage?event=send&email=${window.document.getElementById('mysub_email').value}`;
    fetch(url, {
        method: "GET"
    }).then((res) => {
        res.json().then((data, errors) => {
            if (typeof errors !== 'undefined') {
                console.log(`Sending my subscription portal errors: ${JSON.stringify(errors)}`);
                return;
            }
            console.log(`data: ${JSON.stringify(data)}`);
            let html = '';
            if (typeof data.link === 'undefined') {
                html = 'No data found';
            } else {
                html = `<p>You can access to your subscription page
                through &#128073;<a href="${data.link}" target="_blank">this link</a><br/>
                (<b>note that this should be shared by real email sending for real usage!</b>)</p>`;
            }
            window.document.getElementById('mysub_res').innerHTML = html;
        });
    });
};