let AGITokenAbi = require("singularitynet-token-contracts/abi/SingularityNetToken.json");
let MPEAbi = require("singularitynet-platform-contracts/abi/MultiPartyEscrow.json")
let RegistryAbi = require("singularitynet-platform-contracts/abi/Registry.json")
var ipfsClient = require('ipfs-http-client')
let fetch = require("node-fetch")
let config = require("./config.json")

//var async = require("async");
let contractJSON = "" //require('./contracts/SimpleStorage.json')
var Web3 = require('web3')
const Tx = require('ethereumjs-tx');

const AWS = require("aws-sdk")

//import {Eth} from 'web3-eth';


// AWS Configuration
const region = config.AWSRegion
const ssmVersion = config.SSMVersion
AWS.config.update({ region })
const ssm = new AWS.SSM({ "apiVersion": ssmVersion })

// Ropsten Address
let AGITokenAddress = config.AGITokenAddress
let MPEAddress = config.MPEAddress
let RegistryAddress = config.RegistryAddress
let CuratedServiceURL = config.CuratedServiceURL

var arrServiceDetails = []
var newAccounts = []

async function main() {

    // Ropsten Keys
    const pk = config.PK;
    const totalAccounts2Create = config.TotalAccounts2Create;
    const ethInWei = config.EthInWei                     // 0.1 Eth (17 Zeros after 1)
    const AGIWei = config.AGIWei                         // 0.1 AGI (7 Zeros after 1)
    const expirationBlock = config.ExpirationBlock
    const signerAddress = config.SignerAddress
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
    const web3 = new Web3(config.InfuraURL);
   
    // web3.eth.net.getId().then((netId) => {
    //     console.log("Network Id - " + netId);
    // })

    validateAndSetDefaultAccount(web3, pk)

    getEthBalance(web3).then((bal) => {
            console.log("Eth Balance - " + bal);
    })

    console.log("Data Loaded Initiated...")
    //await loadOrgServices(web3);  // Loads the data from the Blockchain
    await loadCuratedOrgService();  // Loads the data from the API Service call
    console.log("Data Loaded Successfully...")

    var currentChannelId = await getCurrentChannelId(web3)
    //console.log("currentChannelId - " + currentChannelId)

    for(var a=0;a<totalAccounts2Create;a++) {
        // Set Default Account to Base Account
        validateAndSetDefaultAccount(web3, pk)

        // Create a New Account
        var newAccount = createAccount(web3)
        var newAccount_pk = newAccount.privateKey
        newAccount_pk = newAccount_pk.substring(2, newAccount_pk.length)

        // Store Accounts in the Array for Future reference
        newAccounts[newAccount.address] = newAccount_pk

        // Transfer Ether to the newly created Account
        await transferEther(web3, ethInWei, pk, newAccount.address);  //0xa5520765200F78B91e830fc023c0499ae3c73a09

        // Store Account and Key into the AWS Key Store
        // TODO: Need to call Key Store only after successfuly transfer of Ether, Depends on Web3 1.0 Bug Fix
        await storeParameter(newAccount.address, newAccount_pk)

        // Get each service and create a channel
        for(var i=0; i< arrServiceDetails.length; i++) {
            if(arrServiceDetails[i].paymentAddress && arrServiceDetails[i].groupId) {
                console.log("---------------------------------------------------------------------------------")
                console.log(arrServiceDetails[i])

                // *** TODO Need to check base64 decode before passing it to Contract Call

                //const groupId = Buffer.from(arrServiceDetails[i].groupId, 'base64').toString('hex')
                const groupIdInHex = base64ToHex(arrServiceDetails[i].groupId)//web3.utils.fromAscii(groupId)

                // Set the default Account to new Account
                validateAndSetDefaultAccount(web3, newAccount_pk)

                console.log("Opening channel for service..." + arrServiceDetails[i].displayName)

                // Create a channel
                await createChannel(web3, 0, newAccount_pk, arrServiceDetails[i].paymentAddress, groupIdInHex, expirationBlock, signerAddress)

                console.log("&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&")

                if(i>=0) break;
            }
        }

        // Adding Funds to the channel
        // Set the default Account to new Account
        validateAndSetDefaultAccount(web3, pk)

        var newChannelId = await getCurrentChannelId(web3)
        //console.log("newChannelId - " + newChannelId)
        console.log("Adding funds to channel is initiated......")
        console.log("------------------------------------------")
        for(var id=currentChannelId; id<newChannelId; id++) {

            console.log("Getting Details for channel Id: " + id)
            const channelDetails = await getChannelDetails(web3,id)

            // Check whether this channel is created by this Prog
            if(newAccounts[channelDetails.sender]) {
                console.log("Adding funds to the Channel Id - " + id)
                // Add Funds to the Channels created now
                await addFundsToChannel(web3, AGIWei, pk, id)      
            }

        }
        console.log("------------------------------------------")

    }


    //********************************************************************************************* */
    // Sample Function calls to test the output

    //var newAccount = createAccount(web3)
    //await transferEther(web3, 100000000000000000, pk, "0xa5520765200F78B91e830fc023c0499ae3c73a09");
    //await createChannel(web3, 10000000, newAccount.privateKey, arrServiceDetails[i].paymentAddress, arrServiceDetails[i].groupId, 9287016)
    //await depositToken(web3, 100000000, pk)
    //await approveToken(web3, 100000000000, pk)

    // // Transfer 1 Eth to newly created acount
    // transferEther(web3, 1000000000000000000, pk1, newAccount.address);
    // validateAndSetDefaultAccount(web3, newAccount.privateKey)
    //await getMetaDataFromIPFS("QmRhhwQaUMrkEiLF8ysNQRojoBgUL6muTLAfFXhXaneQvS")


    // Sample Contract Interfaces - To Be Deleted Functions

    // Sample Functions to inteface with Contracts
    // readFromContract(web3)
    // writeToContract(web3)
    
}

async function loadCuratedOrgService() {

    await fetch(CuratedServiceURL, { method: 'GET'})
    .then(res => res.json())
    .then(data => {

        //console.log(data)

        console.log("Total Services - " + data.data.length)

        if(data.status === "success") {

            for(var i=0;i < data.data.length; i++) {

                // console.log("Org Id - " + data.data[i].org_id + " - " + data.data[i].service_id + " - " + data.data[i].display_name + " - " + 
                // data.data[i].groups.default_group.group_id + " - " + data.data[i].groups.default_group.payment_address + " - " + data.data[i].ipfs_hash)
                // console.log("-------------------------------------------")

                var obj = {
                    "orgId": data.data[i].org_id,
                    "serviceId": data.data[i].service_id,
                    "displayName": data.data[i].display_name,
                    "groupId": data.data[i].groups.default_group.group_id,
                    "paymentAddress": data.data[i].groups.default_group.payment_address,
                    "ipfsHash": data.data[i].ipfs_hash,
                }
                arrServiceDetails.push(obj)
            }
        }
    })
    .catch(err => console.log("Error loading the from service - " + err));

}

function base64ToHex(base64String) {
    var byteSig = Buffer.from(base64String, 'base64');
    //let buff = new Buffer(byteSig);
    let hexString = "0x"+byteSig.toString('hex');
    return hexString;
  }

function validateAndSetDefaultAccount(web3, pk) {

    var account = web3.eth.accounts.privateKeyToAccount("0x" + pk);

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


    console.log("*************************************************************************************")
    var newAccount = web3.eth.accounts.create(web3.utils.randomHex(32));
    console.log("New Account has been created!")

    console.log("address - " + newAccount.address )
    console.log("privateKey  - " + newAccount.privateKey )

    console.log("*************************************************************************************")

    return newAccount;

}

async function approveToken(web3, weiAmount, fromAccount_pk) {

    var account = web3.eth.accounts.privateKeyToAccount("0x" + fromAccount_pk);
    var TokenContract = new web3.eth.Contract(AGITokenAbi, AGITokenAddress, {gasPrice: '10000000', from: web3.eth.defaultAccount});

    const privateKey = Buffer.from(fromAccount_pk, 'hex')

    TokenContract.methods.balanceOf(web3.eth.defaultAccount).call({from: web3.eth.defaultAccount}, (error, result) => {
        console.log("token balance - " + result);
    });

    console.log("account.address - " +  account.address)

    const query = TokenContract.methods.approve(MPEAddress, weiAmount);
    const encodedABI = query.encodeABI();

    var nonce = await web3.eth.getTransactionCount(account.address)

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

    try {

        var txnHash = await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
        console.log("Txn approve allowance is submitted to network - " + txnHash)

    } catch(error) {
        console.error("Error while approving allowances for MPE contract address - " + MPEAddress)
    }

    // web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
    // .on('receipt', console.log)
    // .catch((err) => {console.log("Error - " + err)})

}

async function transferEther(web3, weiAmount, fromAccount_pk, toAccount) {

    // Gas Limits are hard coded we need to get it frm estimated gas

    const privateKey = Buffer.from(fromAccount_pk, 'hex')

    var account = web3.eth.accounts.privateKeyToAccount('0x' + fromAccount_pk);
    var nonce ;

    nonce = await web3.eth.getTransactionCount(account.address);

    console.log("nonce - " + nonce);

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


    try {

        const txnHash = await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
        console.log("Txn Eth Transfer has submitted to network - " + txnHash)

    } catch(error) {
        console.error("Error while transferring ether to account - " + toAccount)
    }
    

    // web3.eth.getTransactionCount(account.address).then((_nonce) => {
    //     console.log("nonce - " + _nonce);            
    // })    
}

async function depositToken(web3, AGIAmount, fromAccount_pk) {

    var account = web3.eth.accounts.privateKeyToAccount("0x" + fromAccount_pk);
    //var TokenContract = new web3.eth.Contract(AGITokenAbi, AGITokenAddress, {gasPrice: '10000000', from: web3.eth.defaultAccount});

    var MPEContract = new web3.eth.Contract(MPEAbi, MPEAddress, {gasPrice: '10000000', from: web3.eth.defaultAccount});

    const privateKey = Buffer.from(fromAccount_pk, 'hex')

    const query = MPEContract.methods.deposit(AGIAmount);
    const encodedABI = query.encodeABI();

    var nonce = await web3.eth.getTransactionCount(account.address)

    const rawTx = {
        nonce: nonce,
        gasPrice: "0x098bca5a00",
        gasLimit: 2100000,
        to: MPEAddress,
        value: 0,
        data: encodedABI,
        }

    const tx = new Tx(rawTx);
    tx.sign(privateKey);

    const serializedTx = tx.serialize();

    try {

        var txnHash = await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
        console.log("Txn deposit AGI is submitted to network - " + txnHash)

    } catch(error) {
        console.error("Error while depositing to MPE contract address - " + MPEAddress)
        //console.log(error)
    }

}

async function addFundsToChannel(web3, AGIWeiAmount, fromAccount_pk, channelId) {

    var account = web3.eth.accounts.privateKeyToAccount("0x" + fromAccount_pk);
    //var TokenContract = new web3.eth.Contract(AGITokenAbi, AGITokenAddress, {gasPrice: '10000000', from: web3.eth.defaultAccount});

    var MPEContract = new web3.eth.Contract(MPEAbi, MPEAddress, {gasPrice: '10000000', from: web3.eth.defaultAccount});

    const privateKey = Buffer.from(fromAccount_pk, 'hex')

    const query = MPEContract.methods.channelAddFunds(channelId, AGIWeiAmount);
    const encodedABI = query.encodeABI();

    var nonce = await web3.eth.getTransactionCount(account.address)

    const rawTx = {
        nonce: nonce,
        gasPrice: "0x098bca5a00",
        gasLimit: 2100000,
        to: MPEAddress,
        value: 0,
        data: encodedABI,
        }

    const tx = new Tx(rawTx);
    tx.sign(privateKey);

    const serializedTx = tx.serialize();

    try {

        var txnHash = await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
        console.log("Txn Add AGI to Channel is submitted to network - " + txnHash)

    } catch(error) {
        console.error("Error while Adding AGI to Channel to MPE contract address - " + MPEAddress)
        //console.log(error)
    }
}

async function createChannel(web3, AGIAmount, fromAccount_pk, recipientAddress, groupId, expirationBlockNumber, signerAddress) {

    //address signer, address recipient, bytes32 groupId, uint256 value, uint256 expiration

    var account = web3.eth.accounts.privateKeyToAccount("0x" + fromAccount_pk);
    //var TokenContract = new web3.eth.Contract(AGITokenAbi, AGITokenAddress, {gasPrice: '10000000', from: web3.eth.defaultAccount});

    var MPEContract = new web3.eth.Contract(MPEAbi, MPEAddress, {gasPrice: '10000000', from: web3.eth.defaultAccount});

    const privateKey = Buffer.from(fromAccount_pk, 'hex')

    var _signerAddress = signerAddress;
    if(signerAddress === "" || signerAddress === "self") {
        _signerAddress = account.address
    }

    // Can be a different signer address as well
    const query = MPEContract.methods.openChannel(_signerAddress, recipientAddress, groupId, AGIAmount, expirationBlockNumber);
    const encodedABI = query.encodeABI();

    var nonce = await web3.eth.getTransactionCount(account.address)

    const rawTx = {
        nonce: nonce,
        gasPrice: "0x098bca5a00",
        gasLimit: "0x028b7b",
        to: MPEAddress,
        value: "0x00",
        data: encodedABI,
        }

    const tx = new Tx(rawTx);
    tx.sign(privateKey);

    const serializedTx = tx.serialize();

    try {

        var txnHash = await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
        console.log("Txn to create new channel is submitted to network - " + txnHash)

    } catch(error) {
        console.error("Error while creating channel from address - " + account.address)
        //console.log(error)
    }

}

async function getCurrentChannelId(web3) {
    
    var MPEContract = new web3.eth.Contract(MPEAbi, MPEAddress);

    const nextChannelId = (await MPEContract.methods.nextChannelId.call())
    
    return nextChannelId;
}

async function getChannelDetails(web3, channelId) {

    var MPEContract = new web3.eth.Contract(MPEAbi, MPEAddress);
    console.log("channelId - " + channelId)
    const channelDetails = (await MPEContract.methods.channels(channelId).call())
    
    console.log("channelDetails - " + JSON.stringify(channelDetails));

    return channelDetails;
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

    console.log("Loading data...")

    var RegistryContract = new web3.eth.Contract(RegistryAbi, RegistryAddress, {from: web3.eth.defaultAccount});

    //var orgId  = "0x736e657400000000000000000000000000000000000000000000000000000000"

    const orgIds = await getOrgnizations(web3)
    for(var i=0;i<orgIds.length; i++) {
        const orgId = orgIds[i]
        //console.log("Organization Id - " + orgId)
        //console.log("---------------------------")

        const serviceIds = await getOrganizationServices(web3, orgId)
        //console.log("serviceIds.length - " + serviceIds.length)

        for(var j=0; j< serviceIds.length;j++) {
            const serviceId = serviceIds[j]
            //console.log("service Id - " + serviceId)
            // console.log("=================================")

            const serviceDetails = await getServiceDetails(web3,orgId, serviceId)
            //console.log(serviceDetails)            
            console.log(web3.utils.hexToUtf8(serviceDetails.metadataURI))
            // console.log("***********************")

            var ipfsHash = web3.utils.hexToUtf8(serviceDetails.metadataURI).replace("ipfs://", "");

            try {
                //var dataJSON = await getMetaDataFromIPFS(ipfsHash)
                var dataJSON = await getMetaDataFromIPFS(ipfsHash)
                if(dataJSON.display_name) {
                    //console.log("dataJSON payment_address - " + dataJSON.display_name);

                    var obj = {
                        "orgId": orgId,
                        "serviceId": serviceId,
                        "displayName": dataJSON.display_name,
                        "groupId": dataJSON.groups[0].group_id,
                        "paymentAddress": dataJSON.groups[0].payment_address,
                        "ipfsHash": ipfsHash,
                    }
                    arrServiceDetails.push(obj)
                }
            } catch(error) {
                console.error("Error while fetch IPFS Data for - " + ipfsHash)
            }
            
        }
    }

    console.log("End of the Function call....")
    
}

async function getMetaDataFromIPFS(_ipfshash) {

    var ipfs  = ipfsClient({ host: 'ipfs.singularitynet.io', port: 80, protocol: 'http' });
    
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

}

async function storeParameter(account, value) {

    const parameterName = config.ParameterPrefix + account
    var params = {
        Name: parameterName, 
        Type: 'String', 
        Value: value, 
        Overwrite: false,
      };
    
      console.log("Initiared the Key Store for parameter - " + parameterName)
      await ssm.putParameter(params, function(err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else     console.log("Successfully Stored Key Value for the account!" + data);           // successful response
      });

}

async function getParameter(account) {

    const parameterName = config.ParameterPrefix + account
    var params = {
        Name: parameterName,
        WithDecryption: false
      };
    
      console.log("Getting from Key Store for parameter - " + parameterName)
      await ssm.getParameter(params, function(err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else     console.log("Key Store String - " + JSON.stringify(data));           // successful response
      });
}

main();
