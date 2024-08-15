//Configure sizes
var ppi = 600;
var page = [8.5, 11];
//Constants
const aidWidth = 2;
const aidOffset = aidWidth / 2;
//card size
var cardWidth = parseInt(document.querySelector("#cardWidth").value);
var cardHeight = parseInt(document.querySelector("#cardHeight").value);
//bleed edge
var cardPaddingX = parseInt(document.querySelector("#cardPadding").value);
var cardPaddingY = cardPaddingX;
//whitespace
var cardMarginX =  parseInt(document.querySelector("#cardMargin").value);
var cardMarginY = cardMarginX;
//booleans
var imgIncludesBleedEdge = true;
var bleedEdgeColor = "black";
var useCuttingAids = false;
//Prepare variables/canvas/context
var imageList = [];
var canvas = document.querySelector('canvas');
var context = canvas.getContext('2d');
drawSheet();
//svgs
var cuttingGuides = new Image();
cuttingGuides.src = 'cuttingGuides.svg';
var blackPixel = new Image();
blackPixel.src = 'black.png';

function uploadCard(card, filename) {
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {imageList.push(this); drawSheet();}
    img.filename = filename.replace('filename=', '');
    img.src = card;
}
//buffer to avoid drawing the sheet *too* many times when uploading multiple images at the same time
var drawingSheet;
function drawSheet() {
    clearTimeout(drawingSheet);
    drawingSheet = setTimeout(drawSheetReal, 500);
}
function drawSheetReal() {
    //Prepare canvases
    canvas.width = page[0] * ppi;
    canvas.height = page[1] * ppi;
    context.clearRect(0, 0, page[0] * ppi, page[1] * ppi);
    //Calc actual card size
    const cw =  cardWidth + 2 * cardPaddingX + cardMarginX;
    const ch = cardHeight + 2 * cardPaddingY + cardMarginY;
    //Calc number of cards that fit on the sheet
    const cardsX = Math.floor(page[0] / (cw / ppi));
    const cardsY = Math.floor(page[1] / (ch / ppi));
    //Calc page margins
    const pageMarginX = Math.floor((page[0] * ppi - cardsX * cw) / 2);
    const pageMarginY = Math.floor((page[1] * ppi - cardsY * ch) / 2);
    //Draw cutting guides that cover the page
    var count = 0;
    if (useCuttingAids) {
        for (var i = 0; i < cardsX; i++) {
            var x = pageMarginX + i * cw + Math.floor(cardMarginX / 2) + cardPaddingX - aidOffset;
            context.fillRect(x,  0, aidWidth, page[1] * ppi);
            context.fillRect(x + cardWidth, 0, aidWidth, page[1] * ppi);
        }
        for (var j = 0; j < cardsY; j++) {
            var y = pageMarginY + j * ch + Math.floor(cardMarginY / 2) + cardPaddingY - aidOffset;
            context.fillRect(0, y, page[0] * ppi, aidWidth);
            context.fillRect(0, y + cardHeight, page[0] * ppi, aidWidth);
        }
    }
    //Iterate through every viable space and draw the card there
    count = 0;
    for (var i = imageList.length - 1; i >= 0 && count < cardsX * cardsY; i--) {
        if (imageList[i].width > 1) {
            try {
                //Calc upper-left corner of card *image* (accounts for bleed edge and margins)
                var x = pageMarginX + (count % cardsX)                      * (cw) + Math.floor(cardMarginX / 2) + cardPaddingX;
                var y = pageMarginY + (Math.floor(count / cardsX) % cardsY) * (ch) + Math.floor(cardMarginY / 2) + cardPaddingY;
                var w = cardWidth;
                var h = cardHeight;
                if (imgIncludesBleedEdge) {
                    context.drawImage(imageList[i], x - cardPaddingX, y - cardPaddingY, w + 2 * cardPaddingX, h + 2 * cardPaddingY);
                } else {
                    context.fillStyle = bleedEdgeColor;
                    context.fillRect(x - cardPaddingX, y - cardPaddingY, w + 2 * cardPaddingX, h + 2 * cardPaddingY);
                    context.drawImage(imageList[i], x, y, w, h);
                }
                if (useCuttingAids) {
                    context.drawImage(cuttingGuides, x, y, w, h);
                }
                count ++;
            } catch {
                console.log('image failed.');
            }
        }
    }
}

function downloadCanvas() {
    var download = document.createElement('a');
    download.download = 'print.png';
    download.href = canvas.toDataURL();
    document.body.appendChild(download);
    download.click();
    download.remove();
}

async function handleFileUpload(files) {
    for (let file of files) {
        if (file.type === 'application/x-zip-compressed') {
            await processZipFile(file);
        } else {
            uploadCard(URL.createObjectURL(file), file.name);
        }
    }
}

async function processZipFile(zipFile) {
    const zip = await JSZip.loadAsync(zipFile);
    for (let filename in zip.files) {
        if (zip.files[filename].dir) continue;
        const blob = await zip.files[filename].async('blob');
        uploadCard(URL.createObjectURL(blob), filename);
    }
}

async function downloadPDF() {
    const pageOrientation = page[0] > page[1] ? 'landscape' : 'portrait';
    const doc = new jsPDF({
        orientation: pageOrientation,
        unit: 'in',
        format: [page[0], page[1]]
    });

    const cardsPerPage = 9; // 3x3 grid
    const totalPages = Math.ceil(imageList.length / cardsPerPage);

    // Create a temporary canvas for image processing
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    for (let pageNum = 0; pageNum < totalPages; pageNum++) {
        if (pageNum > 0) {
            doc.addPage();
        }
        await drawPDFPage(doc, pageNum * cardsPerPage, tempCanvas, tempCtx);
    }

    doc.save('print.pdf');
}

async function drawPDFPage(doc, startIndex, tempCanvas, tempCtx) {
    const targetDPI = 300;
    const scaleFactor = targetDPI / ppi;

    // Calculate card and page dimensions
    const cw = cardWidth + 2 * cardPaddingX + cardMarginX;
    const ch = cardHeight + 2 * cardPaddingY + cardMarginY;
    const cardsX = Math.floor(page[0] / (cw / ppi));
    const cardsY = Math.floor(page[1] / (ch / ppi));
    const pageMarginX = Math.floor((page[0] * ppi - cardsX * cw) / 2);
    const pageMarginY = Math.floor((page[1] * ppi - cardsY * ch) / 2);

    // Draw cutting guides
    if (useCuttingAids) {
        for (var i = 0; i < cardsX; i++) {
            var x = pageMarginX + i * cw + Math.floor(cardMarginX / 2) + cardPaddingX - aidOffset;
            doc.addImage(blackPixel, "PNG", x / ppi, 0, aidWidth / ppi, page[1]);
            doc.addImage(blackPixel, "PNG", (x + cardWidth) / ppi, 0, aidWidth / ppi, page[1]);
        }
        for (var j = 0; j < cardsY; j++) {
            var y = pageMarginY + j * ch + Math.floor(cardMarginY / 2) + cardPaddingY - aidOffset;
            doc.addImage(blackPixel, "PNG", 0, y / ppi, page[0], aidWidth / ppi);
            doc.addImage(blackPixel, "PNG", 0, (y + cardHeight) / ppi, page[0], aidWidth / ppi);
        }
    }

    // Draw cards
    for (let i = 0; i < 9 && startIndex + i < imageList.length; i++) {
        const img = imageList[startIndex + i];
        if (img.width > 1) {
            try {
                const x = pageMarginX + (i % 3) * cw + Math.floor(cardMarginX / 2) + cardPaddingX;
                const y = pageMarginY + Math.floor(i / 3) * ch + Math.floor(cardMarginY / 2) + cardPaddingY;
                const w = cardWidth;
                const h = cardHeight;

                // Set temporary canvas size
                tempCanvas.width = Math.round(w * scaleFactor);
                tempCanvas.height = Math.round(h * scaleFactor);

                // Draw and scale the image
                if (imgIncludesBleedEdge) {
                    tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
                } else {
                    tempCtx.fillStyle = bleedEdgeColor;
                    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                    tempCtx.drawImage(img, cardPaddingX * scaleFactor, cardPaddingY * scaleFactor, 
                                      w * scaleFactor, h * scaleFactor);
                }

                // Add the processed image to the PDF
                doc.addImage(tempCanvas, "JPEG", x / ppi, y / ppi, w / ppi, h / ppi, 
                             undefined, 'MEDIUM', 0);

                if (useCuttingAids) {
                    doc.addImage(cuttingGuides, "PNG", x / ppi, y / ppi, w / ppi, h / ppi);
                }
            } catch (error) {
                console.log('Image failed:', error);
            }
        }
    }
}

//Manages page
function setPageSize(size = [8.5, 11]) {
    page[0] = parseFloat(size[0]);
    page[1] = parseFloat(size[1]);
    drawSheet();
}
function changeOrientation() {
    setPageSize([page[1], page[0]]);
}
//Sets PPI, recalculates card measurements
function setPPI(inputPPI) {
    var oldPPI = ppi;
    ppi = parseInt(inputPPI);
    var scale = ppi / oldPPI;
    cardWidth *= scale;
    cardHeight *= scale;
    drawSheet();
}
//Sets specific card dimensions
function setCardSize(size) {
    if (size) {
        document.querySelector("#cardWidth").value = Math.round(size[0] * ppi);
        document.querySelector("#cardHeight").value = Math.round(size[1] * ppi);
    }
    cardWidth = parseInt(document.querySelector("#cardWidth").value);
    cardHeight = parseInt(document.querySelector("#cardHeight").value);
    drawSheet();
}
function setPaddingSize(size) {
    cardPaddingX = parseInt(size);
    cardPaddingY = cardPaddingX;
    drawSheet();
}
function setMarginSize(size) {
    cardMarginX = parseInt(size);
    cardMarginY = cardMarginX;
    drawSheet();
}
//Sets booleans
function setBleedEdge(bool) {
    imgIncludesBleedEdge = bool;
    drawSheet();
}
function setBleedEdgeColor(color) {
    bleedEdgeColor = color;
    drawSheet();
}
function setCuttingAids(bool) {
    useCuttingAids = bool;
    drawSheet();
}
//Default print configurations
function saveDefaults() {
    var cardObject = {
        ppi:ppi,
        page:page,
        cardWidth:cardWidth,
        cardHeight:cardHeight,
        cardMarginX:cardMarginX,
        cardMarginY:cardMarginY,
        cardPaddingX:cardPaddingX,
        cardPaddingY:cardPaddingY,
        bleedEdge:imgIncludesBleedEdge,
        bleedEdgeColor:bleedEdgeColor,
        cuttingAids:useCuttingAids
    }
    localStorage.setItem("cardPrintConfig", JSON.stringify(cardObject));
}
function loadDefaults() {
    var cardObject = JSON.parse(localStorage.getItem("cardPrintConfig"))
    if (cardObject && cardObject != {}) {
        ppi = cardObject.ppi;
        document.querySelector("#cardPPI").value = ppi;
        page = cardObject.page;
        cardWidth = cardObject.cardWidth;
        document.querySelector("#cardWidth").value = cardWidth;
        cardHeight = cardObject.cardHeight;
        document.querySelector("#cardHeight").value = cardHeight;
        cardMarginX = cardObject.cardMarginX;
        cardMarginY = cardObject.cardMarginY;
        document.querySelector("#cardMargin").value = cardMarginX;
        cardPaddingX = cardObject.cardPaddingX;
        cardPaddingY = cardObject.cardPaddingY;
        document.querySelector("#cardPadding").value = cardPaddingX;
        imgIncludesBleedEdge = cardObject.bleedEdge;
        document.querySelector("#bleedEdgeCheckbox").checked = imgIncludesBleedEdge;
        bleedEdgeColor = cardObject.bleedEdgeColor || bleedEdgeColor;
        document.querySelector("#bleedEdgeColor").value = bleedEdgeColor;
        useCuttingAids = cardObject.cuttingAids;
        document.querySelector("#cuttingAidsCheckbox").checked = useCuttingAids;
    }
}

loadDefaults();