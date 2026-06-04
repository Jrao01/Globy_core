import {getIpInfo} from "../utils/ipGuide.js";

getIpInfo("8.8.8.8").then(info => {
    console.log(info)
}).catch(err => {
    console.error("Error fetching IP info:", err);
});