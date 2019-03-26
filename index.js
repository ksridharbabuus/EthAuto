let AGITokenAbi = require("singularitynet-token-contracts/abi/SingularityNetToken.json");
let MPEAbi = require("singularitynet-platform-contracts/abi/MultiPartyEscrow.json")
let RegistryAbi = require("singularitynet-platform-contracts/abi/Registry.json")
var ipfsClient = require('ipfs-http-client')

var async = require("async");

let contractJSON = "" //require('./contracts/SimpleStorage.json')
var Web3 = require('web3')
const Tx = require('ethereumjs-tx');

//import {Eth} from 'web3-eth';

// Ropsten Address
let AGITokenAddress = "0xb97E9bBB6fd49865709d3F1576e8506ad640a13B" 
let MPEAddress = "0x7e6366fbe3bdfce3c906667911fc5237cc96bd08"
let RegistryAddress = "0x5156fde2ca71da4398f8c76763c41bc9633875e4"


async function main() {

    // Ropsten Keys
    const pk = ""
    const pk1 = ""

    console.log("initiating the script for automation...")

    // const options = {
    //     defaultAccount: '0x0',
    //     defaultBlock: 'latest',
    //     defaultGas: 1,
    //     defaultGasPrice: 0,
    //     transactionBlockTimeout: 50,
    //     transactionConfirmationBlocks: 24,
    //     transactionPollingTimeout: 480,
    //     transactionSigner: new CustomTransactionSigner()
    // }
    
    
    //const web3 = new Web3('http://localhost:8545');
    const web3 = new Web3('https://ropsten.infura.io');

console.log("Current Provider - " + web3.currentProvider)

    
    // web3.eth.net.getId().then((netId) => {
    //     console.log("Network Id - " + netId);
    // })

    validateAndSetDefaultAccount(web3, pk)

    getEthBalance(web3).then((bal) => {
            console.log("Eth Balance - " + bal);
    })


    await loadOrgServices(web3);

    //await getMetaDataFromIPFS("QmRhhwQaUMrkEiLF8ysNQRojoBgUL6muTLAfFXhXaneQvS")


    console.log("Data Loaded Successfully...")

    //approveToken(web3, 100000000000, pk1)

    // var newAccount = createAccount(web3)

    // // Transfer 1 Eth to newly created acount
    // transferEther(web3, 1000000000000000000, pk1, newAccount.address);

    // validateAndSetDefaultAccount(web3, newAccount.privateKey)





    //********************************************************************************************* */
    // Sample Functions to inteface with Contracts
    // readFromContract(web3)
    // writeToContract(web3)
    
}

function validateAndSetDefaultAccount(web3, pk) {

    var account = web3.eth.accounts.privateKeyToAccount(pk);

    console.log("setting Deault Account to " + account.address )

    web3.eth.defaultAccount = account.address;

    return account;
}

function getEthBalance(web3) {

    return new Promise(function(resolve, reject) {
        web3.eth.getBalance(web3.eth.defaultAccount).then((bal) => {
            resolve(bal);
        })
    })

}

function createAccount(web3) {

    var newAccount = web3.eth.accounts.create(web3.utils.randomHex(32));
    console.log("New Account has been created!")

    console.log("address - " + newAccount.address )
    console.log("privateKey  - " + newAccount.privateKey )

    console.log("---------------------------------------------")

    return newAccount;

}

function transferEther(web3, weiAmount, fromAccount_pk, toAccount) {

    // Gas Limits are hard coded we need to get it frm estimated gas

    const privateKey = new Buffer(fromAccount_pk, 'hex')

    var account = web3.eth.accounts.privateKeyToAccount('0x' + fromAccount_pk);
    var nonce ;

    web3.eth.getTransactionCount(account.address).then((_nonce) => {
        console.log("nonce - " + _nonce);
        nonce = _nonce

        const rawTx = {
            nonce: nonce,
            gasPrice: 200000,
            gasLimit: 21000,
            to: toAccount,
            value: weiAmount,
            data: ''
            }
        
            const tx = new Tx(rawTx);
            tx.sign(privateKey);
        
            const serializedTx = tx.serialize();
        
            console.log("serializedTx - " + serializedTx.toString('hex'));
        
            web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
            .on('receipt', console.log);
            
    })    
}


async function getOrgnizations(web3) {

    var RegistryContract = new web3.eth.Contract(RegistryAbi, RegistryAddress, {from: web3.eth.defaultAccount});

    const orgIds = (await RegistryContract.methods.listOrganizations.call())
    
    return orgIds;

}

async function getOrganizationServices(web3, orgId) {

    var RegistryContract = new web3.eth.Contract(RegistryAbi, RegistryAddress, {from: web3.eth.defaultAccount});

    const service = await RegistryContract.methods.listServicesForOrganization(orgId).call()
    
    return service.serviceIds;
}

async function getServiceDetails(web3, orgId, serviceId) {

    var RegistryContract = new web3.eth.Contract(RegistryAbi, RegistryAddress, {from: web3.eth.defaultAccount});

    const serviceDetails = await RegistryContract.methods.getServiceRegistrationById(orgId, serviceId).call()
    
    return serviceDetails;
}

async function loadOrgServices(web3) {

    var RegistryContract = new web3.eth.Contract(RegistryAbi, RegistryAddress, {from: web3.eth.defaultAccount});

    //var orgId  = "0x736e657400000000000000000000000000000000000000000000000000000000"

    const orgIds = await getOrgnizations(web3)

    for(var i=0;i<orgIds.length; i++) {
        const orgId = orgIds[i]
        console.log("Organization Id - " + orgId)
        console.log("---------------------------")

        const serviceIds = await getOrganizationServices(web3, orgId)

        for(var j=0; j< serviceIds.length;j++) {
            const serviceId = serviceIds[j]
            console.log("service Id - " + serviceId)
            console.log("=================================")

            const serviceDetails = await getServiceDetails(web3,orgId, serviceId)
            console.log(web3.utils.hexToUtf8(serviceDetails.metadataURI))
            console.log("***********************")

            var ipfsHash = web3.utils.hexToUtf8(serviceDetails.metadataURI).replace("ipfs://", "");

            //var dataJSON = await getMetaDataFromIPFS(ipfsHash)
            var dataJSON = await getMetaDataFromIPFS(ipfsHash)
            if(dataJSON.display_name) {
                //console.log("dataJSON payment_address - " + dataJSON.display_name);
            }
        }
    }

    // async forEach is not working as expected :(
    // await async.forEach(orgIds, async (orgId) => {

    //     //console.log("Organization Id - " + orgId)
    //     //console.log("---------------------------")

    //     const serviceIds = await getOrganizationServices(web3, orgId)

    //     //console.log("Service call...")

    //     await async.forEach(serviceIds, async (serviceId) => { 

    //         //console.log("service Id - " + serviceId)

    //         const serviceDetails = await getServiceDetails(web3,orgId, serviceId)

    //         //console.log(web3.utils.hexToUtf8(serviceDetails.metadataURI))
    //         //console.log("***********************")

    //         var ipfsHash = web3.utils.hexToUtf8(serviceDetails.metadataURI).replace("ipfs://", "");

    //         var dataJSON = await getMetaDataFromIPFS(ipfsHash)

    //         console.log("payment_address - " + dataJSON.display_name);

    //     });


    // }); // For each Org Id

    console.log("End of the Function call....")
    
}

async function getMetaDataFromIPFS(_ipfshash) {

    var ipfs  = ipfsClient({ host: '', port: 80, protocol: 'http' });
    
    var dataJSON = null;   

    //const ipfsPromise = await ipfs.get(_ipfshash.trim())

    let ipfsPromise = new Promise((resolve, reject) => {

        ipfs.get(_ipfshash.trim(), function (err, files) {

                if(err) {
                    reject(err)
                }
                if(files) {
                    files.forEach( async (file) => {

                        var resString = file.content.toString('utf8')
                        //console.log("resString - " + resString) 
                        dataJSON = JSON.parse(resString)

                        //const paymentAddress = dataJSON.groups[0].payment_address
                        //const serviceName = dataJSON.display_name

                        //console.log("paymentAddress - " + paymentAddress)
                        resolve(dataJSON)
                    })
                }
            })
    })

    let result = await ipfsPromise;

    return result;
    // await ipfs.get(_ipfshash.trim(), async function (err, files) {

    //     if(files) {

    //          await files.forEach( async (file) => {

    //             var resString = file.content.toString('utf8')
    //             //console.log("resString - " + resString) 
    //             dataJSON = JSON.parse(resString)

    //             const paymentAddress = dataJSON.groups[0].payment_address
    //             const serviceName = dataJSON.display_name

    //             console.log("paymentAddress - " + paymentAddress)
    //         })
    //     }
    //     return dataJSON;   
    // })

}

function getMPEBalance() {

}

function createChannel() {
    
}

async function approveToken(web3, weiAmount, fromAccount_pk) {

    var account = web3.eth.accounts.privateKeyToAccount("0x" + fromAccount_pk);
    var TokenContract = new web3.eth.Contract(AGITokenAbi, AGITokenAddress, {gasPrice: '10000000', from: web3.eth.defaultAccount});

    const privateKey = new Buffer(fromAccount_pk, 'hex')

    TokenContract.methods.balanceOf(web3.eth.defaultAccount).call({from: web3.eth.defaultAccount}, (error, result) => {
        console.log("token balance - " + result);
    });

    console.log("account.address - " +  account.address)

    const query = TokenContract.methods.approve(MPEAddress, weiAmount);
    const encodedABI = query.encodeABI();

    web3.eth.getTransactionCount(account.address).then((_nonce) => {
        console.log("nonce - " + _nonce);
        nonce = _nonce

        const rawTx = {
            nonce: nonce,
            gasPrice: "0x098bca5a00",
            gasLimit: 2100000,
            to: AGITokenAddress,
            value: 0,
            data: encodedABI,
            }

            const tx = new Tx(rawTx);
            tx.sign(privateKey);
        
            const serializedTx = tx.serialize();
        
            console.log("serializedTx - " + serializedTx.toString('hex'));
        
            web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
            .on('receipt', console.log)
            .catch((err) => {console.log("Error - " + err)})
    }) 

}

function depositToken(web3) {


}



//***********************************to be removed ********************************************************** */

// function readFromContract(web3) {
//     console.log("web3.eth.defaultAccount - " + web3.eth.defaultAccount)
//     const simpleStorageContractAddress = "0x5b1869d9a4c187f2eaa108f3062412ecf0526b24"
//     var simpleStorageContract = new web3.eth.Contract(contractJSON.abi, simpleStorageContractAddress, {gasPrice: '10000000', from: web3.eth.defaultAccount});

//     console.log("simpleStorageContract - " + simpleStorageContract)

//     simpleStorageContract.methods.storedData().call({from: web3.eth.defaultAccount}, (error, result) => {
//         console.log("result - " + result);
//     });
// }

// function writeToContract(web3) {

//     console.log("web3.eth.defaultAccount - " + web3.eth.defaultAccount)
//     const simpleStorageContractAddress = "0x5b1869d9a4c187f2eaa108f3062412ecf0526b24"
//     var simpleStorageContract = new web3.eth.Contract(contractJSON.abi, simpleStorageContractAddress, {gasPrice: '10000000', from: web3.eth.defaultAccount});

//     console.log("simpleStorageContract - " + simpleStorageContract)

//     simpleStorageContract.methods.set(123).send({from: web3.eth.defaultAccount})
//     .on('transactionHash', (hash) => { console.log("hash - " + hash)})
//     .on('receipt', (receipt) => { console.log("receipt - " + receipt)})

// }


main();
