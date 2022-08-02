import './sass/styles.scss';
import IpfsPinSync from "./IpfsPinSync.js";

const SOURCE_ENDPOINT = `https://api.pinata.cloud/psa`
const DESTINATION_ENDPOINT = `https://api.filebase.io/v1/ipfs`;

let syncConfig = {
    source: {
        endpointUrl: SOURCE_ENDPOINT,
        accessToken: ''
    },
    destination: {
        endpointUrl: DESTINATION_ENDPOINT,
        accessToken: ''
    }
}

document.addEventListener("DOMContentLoaded", function(event) {
    document.getElementById("sourceSubmitButton").addEventListener("click", async function(event) {
        event.preventDefault();
        try {
            await loadSource();
        } catch (err) {
            alert(`An error occurred.  Please check your endpoint and credentials before trying again`)
        }
    });

    document.getElementById("destinationSubmitButton").addEventListener("click", async function(event) {
        event.preventDefault();
        try {
            await loadDestination();
        } catch (err) {
            alert(`An error occurred.  Please check your endpoint and credentials before trying again`)
        }
    });

    document.getElementById("syncSubmitButton").addEventListener("click", async function(event) {
        // Stop the form from submitting by default
        event.preventDefault();
        await syncProviders();
        await loadDestination();
    });
})

function enableSyncButton() {
    if (syncConfig.source.connected === true && syncConfig.destination.connected === true) {
        let syncButton = document.getElementById("syncSubmitButton");

        // Change Visibility of Login Form and Table
        syncButton.classList.remove("disabled");
    }
}

async function loadSource() {
    // Get Credentials from Form
    let sourceLoginForm = document.forms.sourceLogin;
    syncConfig.source.endpointUrl = sourceLoginForm.elements.endpoint.value;
    syncConfig.source.accessToken = sourceLoginForm.elements.token.value;

    // Start new Sync Client
    const ipfsSyncClient = new IpfsPinSync(syncConfig.source);

    // Load List from Source
    const sourceList = await ipfsSyncClient.listSource();
    let sourceHTML = [];
    for (let sourceItem of sourceList) {
        sourceHTML.push(`<tr>
                <th scope="row">${sourceItem.pin.cid}</th>
                <td>${sourceItem.pin.name}</td>
            </tr>`)
    }

    // Update Table of Pinned Content
    let sourceTableBody = document.getElementById("sourceTableBody");
    let sourceTable = document.getElementById("sourceTable");
    sourceTableBody.innerHTML = sourceHTML.join('');

    // Change Visibility of Login Form and Table
    sourceLoginForm.classList.add("d-none");
    sourceTable.classList.remove("d-none");

    // Mark Source Pinning Service as Connected
    syncConfig.source.connected = true;

    // Run Enable Sync Button Check
    enableSyncButton();
}

async function loadDestination() {
    // Get Credentials from Form
    let destinationLoginForm = document.forms.destinationLogin;
    syncConfig.destination.endpointUrl = destinationLoginForm.elements.endpoint.value;
    syncConfig.destination.accessToken = destinationLoginForm.elements.token.value;

    // Start new Sync Client
    const ipfsSyncClient = new IpfsPinSync(undefined, syncConfig.destination);

    // Load List from Source
    const destinationList = await ipfsSyncClient.listDestination();
    let destinationHTML = [];
    for (let destinationItem of destinationList) {
        destinationHTML.push(`<tr>
                <th scope="row">${destinationItem.pin.cid}</th>
                <td>${destinationItem.pin.name}</td>
            </tr>`)
    }

    // Update Table of Pinned Content
    let destinationTableBody = document.getElementById("destinationTableBody");
    let destinationTable = document.getElementById("destinationTable");
    let destinationProgress = document.getElementById("destinationProgress");
    destinationTableBody.innerHTML = destinationHTML.join('');

    // Change Visibility of Login Form and Table
    destinationLoginForm.classList.add("d-none");
    destinationProgress.classList.add("d-none");
    destinationTable.classList.remove("d-none");

    // Mark Destination Pinning Service as Connected
    syncConfig.destination.connected = true;

    // Run Enable Sync Button Check
    enableSyncButton();
}

async function syncProviders() {
    // Start Sync Client
    const ipfsSyncClient = new IpfsPinSync(syncConfig.source, syncConfig.destination);

    // Tracked DOM Elements
    let destinationProgressBody = document.getElementById("destinationProgressBody");
    let destinationProgress = document.getElementById("destinationProgress");
    let destinationTable = document.getElementById("destinationTable");

    // Change Visibility of Login Form and Table
    destinationTable.classList.add("d-none");
    destinationProgress.classList.remove("d-none");

    return ipfsSyncClient.sync(function (progressData) {
        // Update Table of Pinned Content
        destinationProgressBody.innerHTML = `<tr>
                    <th scope="row">Percent</th>
                    <td>${progressData.percent.toFixed(2)}%</td>
                </tr><tr>
                    <th scope="row">Count</th>
                    <td>${progressData.count}</td>
                </tr>`;
    });
}