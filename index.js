import puppeteer from 'puppeteer';
import { branches, years, months } from './src/data.js';
import 'dotenv/config';
import { documentLink, downloadPdf, gotoOptions, initPath, joinPath, reportLinks, saveCookies } from './src/helper.js';

(async () => {

    const baseUrl = process.env.BASE_URL; // Ambil BASE_URL dari environment
    if (!baseUrl) {
        console.error('BASE_URL is not defined in environment variables.');
        return;
    }

    // Launch the browser and open a new blank page
    const browser = await puppeteer.launch({
        headless: false
    });
    const page = await browser.newPage();

    // Navigate the page to a URL
    await page.goto(`${baseUrl}/login`);

    // Mengisi form login
    await page.type('#username', process.env.USERNAME);
    await page.type('#password', process.env.PASSWORD);
    await page.click('button[type="submit"]');

    // Tunggu hingga navigasi ke halaman setelah login
    await page.waitForNavigation();

    // simpan cookies
    await saveCookies(page);

    const start_year = parseInt(process.env.START_YEAR);
    const start_month = parseInt(process.env.START_MONTH);
    const end_year = parseInt(process.env.END_YEAR);
    const end_month = parseInt(process.env.END_MONTH);

    // DownloadPath
    const downloadPath = initPath('./downloads');

    // saya ingin buat folder induk, contoh 'document-omset-{time now}' dalam folder downloads ?
    const currentTime = new Date().toISOString().replace(/[-:.]/g, '').replace('T', '_').slice(0, 15);
    const parentFolder = joinPath(downloadPath, `DOCUMENT-${process.env.DOCUMENT.toUpperCase()}-${currentTime}`);

    for (const branch of branches) {

        // dalam folder induk, buat folder cabang dengan uppercase ?
        const branchFolder = joinPath(parentFolder, branch.name.toUpperCase());

        for (const year of years) {
            if (year < start_year || year > end_year) {
                continue; // Lewati tahun yang tidak dalam rentang yang diinginkan
            }

            // didalam folder cabang, buat folder tahun, contoh 'TAHUN1' ?
            const yearFolder = joinPath(branchFolder, `TAHUN${year}`);

            // Tentukan rentang bulan untuk tahun yang saat ini
            let start = year === start_year ? start_month : 1;
            let end = year === end_year ? end_month : 12;

            for (const month of months) {
                if (month < start || month > end) {
                    continue;
                }

                // didalam folder tahun, buat folder periode, contoh 'PERIODE1' ?
                const monthFolder = joinPath(yearFolder, `PERIODE${month}`);

                let url = `${baseUrl}/report?year=${year}&month_id=${month}&branch_id=${branch.id}&sort=week_id&direction=asc`;
                const links = await reportLinks(baseUrl, url, page)

                for (const report of links) {
                    await page.goto(report, gotoOptions());
                    // Dapatkan current URL dari halaman yang sedang dikunjungi
                    const currentUrl = page.url();

                    // Mengekstrak semua link yang cocok dengan pola `[current_url]/document`
                    const docUrl = await documentLink(page, currentUrl)

                    if (!docUrl) {
                        continue;
                    }

                    // file pdf dalam folder bulan ? 
                    await downloadPdf(docUrl, monthFolder);
                }
            }
        }
    }
    await page.goto(baseUrl, gotoOptions);
    console.log(`DOKUMENT ${process.env.DOCUMENT.toUpperCase()} BERHASIL DI DOWNLOAD`)
    await browser.close();
})();