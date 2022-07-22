import { Configuration, RemotePinningServiceClient, Status } from '@ipfs-shipyard/pinning-service-client'

export default class IpfsPinSync {
    constructor (sourceConfigOptions, destinationConfigOptions) {
        if (typeof sourceConfigOptions !== "undefined" && sourceConfigOptions !== {}) {
            this.#connectToSource(sourceConfigOptions)
        }

        if (typeof destinationConfigOptions !== "undefined" && destinationConfigOptions !== {}) {
            this.#connectToDestination(destinationConfigOptions)
        }
    }

    #connectToSource(sourceConfigOptions) {
        if (!sourceConfigOptions.endpointUrl) {
            throw new Error(`Source endpointUrl must be set`)
        }
        if (!sourceConfigOptions.accessToken) {
            throw new Error(`Source accessToken must be set`)
        }

        const sourceConfig = new Configuration({
            endpointUrl: sourceConfigOptions.endpointUrl, // the URI for your pinning provider, e.g. `http://localhost:3000`
            accessToken: sourceConfigOptions.accessToken, // the secret token/key given to you by your pinning provider
        })

        this.sourceClient = new RemotePinningServiceClient(sourceConfig)
    }

    #connectToDestination(destinationConfigOptions) {
        if (!destinationConfigOptions.endpointUrl) {
            throw new Error(`Destination endpointUrl must be set`)
        }
        if (!destinationConfigOptions.accessToken) {
            throw new Error(`Destination accessToken must be set`)
        }

        const destinationConfig = new Configuration({
            endpointUrl: destinationConfigOptions.endpointUrl, // the URI for your pinning provider, e.g. `http://localhost:3000`
            accessToken: destinationConfigOptions.accessToken, // the secret token/key given to you by your pinning provider
        })

        this.destinationClient = new RemotePinningServiceClient(destinationConfig)
    }

    #getOldestPinCreateDate (pinsResult) {
        let oldestCreateDate = new Date()
        for (let pin of pinsResult) {
            if (pin.created < oldestCreateDate) {
                oldestCreateDate = pin.created
            }
        }
        return oldestCreateDate
    }

    listSource () {
        return this.#list(this.sourceClient);
    }

    listDestination () {
        return this.#list(this.destinationClient);
    }

    async #list (client) {
        let pinsExistToCheck = true
        let earliestPinInList = null
        let pinList = [];

        while (pinsExistToCheck === true) {
            // Get 1000 Successful Pins
            let pinsGetOptions = {
                limit: 1000,
                status: new Set([Status.Pinned, Status.Pinning, Status.Queued]) // requires a set, and not an array
            }
            if (earliestPinInList != null) {
                pinsGetOptions.before = earliestPinInList
            }

            const {count, results} = await client.pinsGet(pinsGetOptions)

            console.log(count, results)
            pinList = pinList.concat(Array.from(results));

            earliestPinInList = this.#getOldestPinCreateDate(results)

            if (results.length !== 1000) {
                pinsExistToCheck = false;
            }
        }

        return pinList;
    }

    async sync (progressCallback) {
        const sourcePins = await this.listSource();

        // Loop over list of pins and pin to destinationClient
        let addPinRequests = [];
        let pinsAdded = 0;
        for (let sourcePin of sourcePins) {
            const pinPostOptions = {
                pin: {
                    cid: sourcePin.pin.cid,
                    name: sourcePin.pin.name,
                    origins: sourcePin.pin.origins,
                    meta: sourcePin.pin.meta
                }
            }

            const addPinRequest = this.addPin(pinPostOptions);

            // Provide Progress Updates
            addPinRequest.then(() => {
                if (progressCallback) {
                    pinsAdded = pinsAdded + 1;
                    progressCallback({
                        percent: (100/sourcePins.length) * pinsAdded,
                        count: pinsAdded
                    });
                }
            })

            addPinRequests.push(addPinRequest);

            //Batch in Requests of 10
            if (addPinRequests.length === 10) {
                // Wait for all Add Request to Finish
                await Promise.all(addPinRequests);
            }
        }

        // Wait for all Add Request to Finish
        await Promise.all(addPinRequests);

        return true;
    }

    async addPin (pinPostOptions) {
        await this.destinationClient.pinsPost(pinPostOptions);
    }
}