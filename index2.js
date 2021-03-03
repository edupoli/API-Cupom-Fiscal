const puppeteer = require('puppeteer');
const request = require('request-promise-native');
const poll = require('promise-poller').default;
const { Launcher } = require('chrome-launcher');
let chromeLauncher = Launcher.getInstallations()[0];



const siteDetails = {
    sitekey: '6LeEy8wUAAAAAHN6Wu2rNdku25fyHUVgovX-rJqM',
    pageurl: 'https://satsp.fazenda.sp.gov.br/COMSAT/Public/ConsultaPublica/ConsultaCupomFiscalEletronico.aspx'
}

const apiKey = 'e3a320c15d2ff9c4dbd773dcf683db86';
const chave = '35210155001879000188590008761890014002325726';

const chromeOptions = {
    executablePath: chromeLauncher || null,
    headless: false,
    slowMo: 20,
    defaultViewport: null,
    ignoreHTTPSErrors: true
};

(async function main() {
    const browser = await puppeteer.launch(chromeOptions);
    const pages = await browser.pages();
    const page = pages[0];
    await page.goto('https://satsp.fazenda.sp.gov.br/COMSAT/Public/ConsultaPublica/ConsultaCupomFiscalEletronico.aspx');
    const requestId = await initiateCaptchaRequest(apiKey);
    await page.evaluate((chave) => {
        document.querySelector('#conteudo_txtChaveAcesso').value = chave;
    }, chave);
    const response = await pollForRequestResults(apiKey, requestId);
    await page.evaluate(`document.getElementById("g-recaptcha-response").innerHTML="${response}";`);
    await page.evaluate(function () {
        reCaptchaCallback();
    });
    page.click('#conteudo_btnConsultar');
    await page.waitForNavigation()
    //await page.pdf({ path: 'hackernews.pdf', format: 'A4' });
    var dados = {};

    const result = await page.$$eval('#tableItens tr', rows => {
        return Array.from(rows, row => {
            const columns = row.querySelectorAll('td');
            return Array.from(columns, column => column.innerText);
        });
    });
    console.log(result)

    // await page.evaluate(() => {

    //     dados.nomeEmitente = document.getElementById('conteudo_lblNomeEmitente').innerText,
    //         dados.enderecoEmitente = document.getElementById('conteudo_lblEnderecoEmintente').innerText,
    //         dados.bairroEmitente = document.getElementById('conteudo_lblBairroEmitente').innerText,
    //         dados.cepEmitente = document.getElementById('conteudo_lblBairroEmitente').innerText,
    //         dados.cidadeEmitente = document.getElementById('conteudo_lblMunicipioEmitente').innerText
    // })
    // console.log(dados)
})()

async function initiateCaptchaRequest(apiKey) {
    const formData = {
        method: 'userrecaptcha',
        googlekey: siteDetails.sitekey,
        key: apiKey,
        pageurl: siteDetails.pageurl,
        json: 1
    };
    const response = await request.post('http://2captcha.com/in.php', { form: formData });
    return JSON.parse(response).request;
}

async function pollForRequestResults(key, id, retries = 30, interval = 1000, delay = 1000) {
    console.log(`Aguardando ${delay} milisegundos para resolver CAPTCHA`)
    await timeout(delay);
    return poll({
        taskFn: requestCaptchaResults(key, id),
        interval,
        retries
    });
}

function requestCaptchaResults(apiKey, requestId) {
    const url = `http://2captcha.com/res.php?key=${apiKey}&action=get&id=${requestId}&json=1`;
    return async function () {
        return new Promise(async function (resolve, reject) {
            console.log('resolvendo....')
            const rawResponse = await request.get(url);
            const resp = JSON.parse(rawResponse);
            if (resp.status === 0) return reject(resp.request);
            console.log('Response received :)')
            resolve(resp.request);
        });
    }
}

const timeout = millis => new Promise(resolve => setTimeout(resolve, millis))
