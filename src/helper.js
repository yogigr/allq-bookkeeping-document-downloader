import path from 'path';
import fs from 'fs';
import needle from 'needle';
import 'dotenv/config';

const gotoOptions = () => {
    return { waitUntil: 'domcontentloaded', timeout: 60000 };
}

const initPath = (pathName) => {
    const initpath = path.resolve(pathName);
    if (!fs.existsSync(initpath)) {
        fs.mkdirSync(initpath, { recursive: true });
    }
    return initpath;
}

const joinPath = (parentPath, pathName) => {
    const joinpath = path.join(parentPath, pathName);
    if (!fs.existsSync(joinpath)) {
        fs.mkdirSync(joinpath, { recursive: true });
    }
    return joinpath;
}

const saveCookies = async (page) => {
    const cookiesFilePath = path.resolve('./cookies.json');

    // Simpan cookies ke file
    const cookies = await page.cookies();
    fs.writeFileSync(cookiesFilePath, JSON.stringify(cookies));
}

const reportLinks = async (baseUrl, reportsUrl, page) => {
    await page.goto(reportsUrl, gotoOptions());

    // Mengekstrak semua link yang cocok dengan pola `${process.env.BASE_URL}/report/{id}`
    return await page.evaluate((baseUrl) => {
        const linkElements = Array.from(document.querySelectorAll('a'));
        const regex = new RegExp(`^${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\/report\\/\\d+$`);
        return linkElements
            .map(link => link.href)
            .filter(href => regex.test(href)); // Hanya link dengan format `${BASE_URL}/report/{id}`, di mana {id} adalah integer
    }, baseUrl);
}

const documentLink = async (page, currentUrl) => {
    const documentLinks = await page.evaluate((currentUrl) => {
        const linkElements = Array.from(document.querySelectorAll('a'));
        return linkElements
            .map(link => link.href)
            .filter(href => href === `${currentUrl}/document`); // Hanya link dengan format `[current_url]/document`
    }, currentUrl);

    // Menampilkan link yang ditemukan
    console.log('Document Link found:', documentLinks);

    // jika link document tidak ditemukan, continue
    if (documentLinks.length <= 0) {
        return false;
    }

    await page.goto(`${documentLinks[0]}?ajax=1`, gotoOptions())
    // Mengekstrak JSON dari elemen <script>
    // Tunggu hingga halaman selesai dimuat
    await page.waitForSelector('pre'); // Menunggu elemen <pre> muncul, di mana JSON disimpan

    // Ambil konten dari elemen <pre> yang berisi JSON
    const jsonContent = await page.evaluate(() => {
        return document.querySelector('pre').textContent;
    });

    /// Parse konten menjadi objek JSON
    const jsonData = JSON.parse(jsonContent);

    // Akses array dari objek JSON
    const arrayOfObjects = jsonData.data;

    // Cari semua objek yang basename-nya mengandung kata kunci document yang diinginkan
    const filteredObjects = arrayOfObjects.filter(item => item.basename.includes(process.env.DOCUMENT));

    // jika tidak ditemukan continue
    if (filteredObjects.length <= 0) {
        return false;
    }

    const doc = filteredObjects[0];

    return doc.url;
}

const downloadPdf = async (pdfUrl, downloadFolder) => {
    const cookiesFilePath = path.resolve('./cookies.json');
    const downloadPath = path.resolve('./downloads');
    // Baca cookies dari file
    const cookies = JSON.parse(fs.readFileSync(cookiesFilePath));

    // Format cookies untuk header
    const cookieHeader = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

    // Buat folder download jika belum ada
    if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath, { recursive: true });
    }

    if (!fs.existsSync(downloadFolder)) {
        fs.mkdirSync(downloadFolder, { recursive: true });
    }

    // Unduh file PDF dengan cookies
    needle.get(pdfUrl, {
        headers: {
            Cookie: cookieHeader
        },
        parse: 'buffer' // Mengatur needle untuk mengembalikan data sebagai buffer
    }, async (err, resp) => {
        if (err) {
            console.error('Failed to download file:', err);
            return;
        }
        // Ambil nama file dari header Content-Disposition
        const contentDisposition = resp.headers['content-disposition'];
        let fileName = 'default.pdf'; // Nama default jika header tidak ada
        if (contentDisposition) {
            // Mengambil nama file dari Content-Disposition
            const matches = /filename="([^"]+)"/.exec(contentDisposition);
            if (matches) {
                fileName = matches[1];
            }
        }

        const filePath = path.join(downloadFolder, fileName);

        // Simpan file
        fs.writeFileSync(filePath, resp.body);
        console.log(`File downloaded to: ${filePath}`);
    });
}

export { gotoOptions, initPath, joinPath, saveCookies, reportLinks, documentLink, downloadPdf };