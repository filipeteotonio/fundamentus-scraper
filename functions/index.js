const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });

const cheerio = require('cheerio');
const fetch = require('node-fetch');
const _ = require('lodash');

getRows = ($) => {
    let rows = $('tr');
    rows = Object.keys(rows).map((key) => {
        if (rows[key].name === 'tr')
            return rows[key];
    }).filter((el) => el !== undefined);
    return rows;
}

extractRowsData = ($, rows, start, end, mixed = false) => {

    let result = {};
    for (let j = start; j < end; j++) {
        let row = rows[j];
        row.children = row.children.filter((child) => child.name === 'td');

        let init = 0;
        let stop = mixed ? 2 : row.children.length;

        for (let i = init; i < stop; i += 1) {
            if (i % 2 == 0) {
                let labelSpan = row.children[i].children[0];
                let valSpan = row.children[i + 1].children[0];

                let label = _.deburr(_.snakeCase($(labelSpan).text()));
                let val = $(valSpan).text();

                if (!label || label === '')
                    continue;

                result[label] = val.replace(',', '.').replace('\n', '').trim();
            }
        }

        if (mixed)
            row.children = row.children.splice(2, row.children.length);
    }

    return result;
}

scrapHtml = ($) => {

    // removes unnecessary cells
    $('span[class="help tips"]').remove();

    let result = {};
    let rows = getRows($);

    try {
        result['empresa'] = extractRowsData($, rows, 0, 7);
        result['oscilacao_cotacoes'] = extractRowsData($, rows, 8, 19, true);
        result['fundamentos'] = extractRowsData($, rows, 8, 19);
        result['balanco_patrimonial'] = extractRowsData($, rows, 20, 23);

        result['demonstrativos_resultados'] = { ultimo_ano: {}, ultimo_trimestre: {} };
        result['demonstrativos_resultados']['ultimo_ano'] = extractRowsData($, rows, 25, 28, true);
        result['demonstrativos_resultados']['ultimo_trimestre'] = extractRowsData($, rows, 25, 28);
    } catch (exception) {
        return null;
    }

    return result;
}

scrap = async (url) => {
    const res = await fetch(url);
    const html = await res.textConverted();
    const $ = cheerio.load(html);
    return scrapHtml($);
}

exports.scraper = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        let url = 'http://www.fundamentus.com.br/detalhes.php?papel=' + req.query.paper;
        const data = await scrap(url);
        if (data === null) {
            res.status(404).send('Not found');
        } else {
            res.send(data);
        }
    })
});