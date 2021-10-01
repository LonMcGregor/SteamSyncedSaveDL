const STEAM_URL = "https://store.steampowered.com/account/remotestorage";

function countStorageSpace(body){
    return Array.from(body.querySelectorAll("#main_content > table > tbody > * > td:nth-child(3)"))
    .map(x => x.outerText)
    .map(x => {
        if(x.indexOf(" B")>-1){
            return parseInt(x.replace(" B", ""))
        } else if(x.indexOf(" KB")>-1){
            return parseFloat(x.replace(" KB", "")) * 1000
        } else if(x.indexOf(" MB")>-1){
            return parseFloat(x.replace(" MB", "")) * 1000 * 1000
        } else if(x.indexOf(" GB")>-1){
            return parseFloat(x.replace(" GB", "")) * 1000 * 1000 * 1000
        } else{
            return 0 // I doubt there will be any larger file sizes
        }
    })
    .reduce((x,y)=>x+y, 0) / (1000 * 1000)
}

function filenameClean(dirty){
    // don't mess with the important file structures of save files,
    // assume them to be safe
    return dirty.trim();

}

function directoryClean(dirty){
    // remove any unsafe characters and replace with a single _
    // sometimes app names can have characters like spaces, ® and ™ in
    // them. that might not be bad, but just to be safe
    const clean = dirty.trim().replace(/[^\w\d\-_]/g, "_").replace(/_+/g, "_");
    if(clean===""){ // sometimes the main save directory is not specified
        return "Saves";
    }
    return clean;
}

function downloadOneFile(appname, row){
    return `curl ${row.querySelector("a").href} --create-dirs -o "SteamSyncedSaves/${directoryClean(appname)}/${directoryClean(row.children[0].innerText)}/${filenameClean(row.children[1].innerText)}"\n`
}

function downloadOneAppsFiles(appname, body){
    const div = document.createElement("div");
    div.innerHTML = body;
    return Array.from(div.querySelectorAll("#main_content > table > tbody > tr"))
    .map(row => downloadOneFile(appname, row))
    .reduce((a,b) => a+b, "")
}

async function downloadOneApp(approw) {
    const appname = approw.children[0].innerText;
    const appfilelisting = await fetch(approw.querySelector("a").href)
    .then(response => response.blob())
    .then(blob => blob.text())
    .then(body => downloadOneAppsFiles(appname, body))
    .catch(e => "echo Failed to download "+approw.querySelector("a").href)
    return appfilelisting;
}

async function downloadAll(body){
    const div = document.createElement("div");
    div.innerHTML = body;
    const space = countStorageSpace(div);
    const apps = Array.from(div.querySelectorAll("#main_content > table > tbody > tr"));
    let wgets = "#!/bin/bash\necho This will require approx "+space+" MB\n";
    for (let i = 0; i < apps.length; i++) {
        const row = apps[i];
        wgets += await downloadOneApp(row);
    }
    const textfile = new File([wgets], "sssdl", {type: "text/plain"});
    chrome.downloads.download({
        url: window.URL.createObjectURL(textfile),
        filename: "sssdl.sh",
        conflictAction: "uniquify",
        saveAs: true
    });
}

function startDownloading(tab) {
    chrome.tabs.create({url: chrome.runtime.getURL("started.html")});
    fetch(STEAM_URL)
    .then(response => response.blob())
    .then(blob => blob.text())
    .then(downloadAll)
}

chrome.browserAction.onClicked.addListener(startDownloading);
