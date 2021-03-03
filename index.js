const express = require('express');
const app = express();
const Router = express.Router();
const path = require('path');
const bodyparser = require('body-parser');
require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const { Launcher } = require('chrome-launcher');
let chromeLauncher = Launcher.getInstallations()[0];

app.use(express.static('public'));
express.static(path.join(__dirname, '/public'));
app.use(bodyparser.urlencoded({ extended: false }));
app.use(bodyparser.json());
app.set('json spaces', 2);
app.use(Router);

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    next();
});

const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha')
puppeteer.use(
    RecaptchaPlugin({
        provider: {
            id: '2captcha',
            token: process.env.token,
        },
        visualFeedback: true,
    })
)
const chromeOptions = {
    executablePath: chromeLauncher || null,
    headless: false,
    slowMo: 10,
    defaultViewport: null,
    ignoreHTTPSErrors: true
};

Router.get('/:chave', (req, res) => {
    let chave = req.params.chave;
    puppeteer.launch(chromeOptions).then(async (browser) => {
        const pages = await browser.pages();
        const page = pages[0];
        await page.goto('https://satsp.fazenda.sp.gov.br/COMSAT/Public/ConsultaPublica/ConsultaCupomFiscalEletronico.aspx');
        await page.evaluate((chave) => {
            document.querySelector('#conteudo_txtChaveAcesso').value = chave;
        }, chave);

        await page.solveRecaptchas();

        await Promise.all([
            page.waitForNavigation(),
            page.click('#conteudo_btnConsultar'),
        ])

        let result = await page.evaluate(async () => {
            var dados = {};
            dados.nomeEmitente = document.getElementById('conteudo_lblNomeEmitente').innerText;
            dados.enderecoEmitente = document.getElementById('conteudo_lblEnderecoEmintente').innerText;
            dados.bairroEmitente = document.getElementById('conteudo_lblBairroEmitente').innerText;
            dados.cepEmitente = document.getElementById('conteudo_lblCepEmitente').innerText;
            dados.cidadeEmitente = document.getElementById('conteudo_lblMunicipioEmitente').innerText;

            let colunas = ["id", "codigo", "descricao", "quantidade", "unidade", "valor_litro", "troco", "valor_total"];
            var tds = document.querySelectorAll('#tableItens td');
            let td_array = [];
            for (var i = 0; i < tds.length - 2; i++) {
                td_array.push(tds[i].textContent);
            }
            for (let idx in colunas) {
                let nomeColuna = colunas[idx];
                dados[nomeColuna] = td_array[idx];
            }
            dados.observacoes = document.getElementById('conteudo_lblObservacaoContribuinte').innerText;
            return dados
        })
        const element = await page.$('#conteudo_divMovimento');
        await element.screenshot({ path: `./Copias-CFe/${chave}.png` })
        console.log(await result)
        //await browser.close()
        res.json(result)
    })
});

app.listen(3000, () => {
    console.log('Servidor Iniciado com Sucesso na Porta 3000!');
});