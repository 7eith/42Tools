const puppeteer = require('puppeteer');
const prompt = require('prompt');


const prompt_attributes = [
    {
        description: 'Your matrix username',
        name: 'username',           // Matrix credentials
        hidden: false,
    },
    {
        description: 'You matrix password (look inside the code if you\'re suspicious)',
        name: 'password',
        hidden: true
    },
];

prompt.start();

prompt.get(prompt_attributes, function (err, result) {
    if (err) {
        console.log(err);
        return 1;
    } else {
        const username = result.username;
        const password = result.password;

        console.log('Fetching from the Matrix ... Please wait');
        mainScrap(username, password);
    }
});

const preparePageForTests = async (page) => {               // Hide chromium from bot detection
    // Pass the User-Agent Test.
    const userAgent = 'Mozilla/5.0 (X11; Linux x86_64)' +
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.39 Safari/537.36';
    await page.setUserAgent(userAgent);

    // Pass the Webdriver Test.
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
        });
    });

    // Pass the Chrome Test.
    await page.evaluateOnNewDocument(() => {
        // We can mock this in as much depth as we need for the test.
        window.navigator.chrome = {
            runtime: {},
            // etc.
        };
    });

    // Pass the Permissions Test.
    await page.evaluateOnNewDocument(() => {
        const originalQuery = window.navigator.permissions.query;
        return window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({state: Notification.permission}) :
                originalQuery(parameters)
        );
    });

    // Pass the Plugins Length Test.
    await page.evaluateOnNewDocument(() => {
        // Overwrite the `plugins` property to use a custom getter.
        Object.defineProperty(navigator, 'plugins', {
            // This just needs to have `length > 0` for the current test,
            // but we could mock the plugins too if necessary.
            get: () => [1, 2, 3, 4, 5],
        });
    });

    // Pass the Languages Test.
    await page.evaluateOnNewDocument(() => {
        // Overwrite the `plugins` property to use a custom getter.
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
        });
    });
};

let login = async (page, url, userName, password) => {          // Login to the matrix

    await page.goto(url);

    await page.evaluate(async () => {
        document.getElementsByClassName('loginButton')[0].click();
    });

    await page.waitForSelector('#user_login', {visible: true, timeout: 0});
    await page.evaluate((userName, password) => {
        document.getElementById('user_login').value = userName;             // Here you go
        document.getElementById('user_password').value = password;
        document.getElementsByClassName('btn btn-login')[0].click();
        return document.getElementById('user_login').value
    }, userName, password);

    await page.waitFor(333);
    const authorizeSelector = 'input[value="Authorize"]';
    await page.waitForSelector(authorizeSelector);
    await page.click(authorizeSelector);
};

let compute = async (page, imgList) => {             // Let the JS magic happen
    let i = 0;
    let c = imgList.length;
    let ret = [];

    while (i < c) {

        let imgLink = imgList[i];
        page.evaluate((imgLink) => {
            let img = document.querySelector(`.userImg[src='${imgLink}']`);
            img.click();
        }, imgLink);


        await page.waitForSelector(`.statValue`, {visible: true, timeout: 0}).then(async () => {

            await page.evaluate(() => {
                return new Promise((resolve, reject) => {

                    if (document.getElementsByClassName('bannerLogo')[0] === undefined) {
                        resolve({
                            name: document.getElementsByClassName('userName')[0].innerText,
                            lvl: parseFloat(document.getElementsByClassName('statValue')[3].innerText)
                        });
                    } else {
                        reject();
                    }
                });
            })
                .then((userDetails) => {
                    ret.push(userDetails);
                })
                .catch(() => console.log('...'));
        });
        i++;
    }
    return ret;
};


async function mainScrap(userName, password) {
    let url = "http://42matrix.tk/";
    const browser = await puppeteer.launch({
        headless: true,
        ignoreHTTPSErrors: true
    });
    const page = await browser.newPage();

    await preparePageForTests(page);            // sneaky mode

    await login(page, url, userName, password);

    await page.waitForSelector('.userImg', {visible: true, timeout: 0});

    let imgList = await page.evaluate(() => {
        let ret = [];
        let users = document.querySelectorAll(".userImg");
        let c = document.querySelectorAll(".userImg").length;
        let i = 0;
        while (i < c) {
            ret.push(users[i].src);
            i++;
        }
        return ret;
    });

    let noobs = await compute(page, imgList);
    console.table(noobs.sort((a, b) => {
        if (a.lvl > b.lvl) {
            return -1;
        } else {
            return 1;
        }
    }));

    await browser.close();
}
