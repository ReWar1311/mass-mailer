 import nodemailer from 'nodemailer';
 import Papa from 'papaparse';
 import fs from 'fs';
 import express from 'express';
 import bodyParser from 'body-parser';

 const app = express();


 app.use(bodyParser.urlencoded({ extended: true }));

 const port=3000;
 var sent=0;
 var failed=0;


app.get("/",(req,res)=>{
    res.render("./index.ejs")}
)
app.post("/submit",(req,res)=>{
    console.log(req.body)
    const csvContent = req.body.csvContent;
    const jsonData = parsetojson(csvContent)
    console.log(jsonData)
    })


 const transporter =nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user:"YOUR EMAIL HERE",
        pass:"YOUR PASSWORD HERE"
    },
    tls: {
    rejectUnauthorized: false // Disables certificate validation
  }
 });


 // Path to your CSV file
const csvFilePath = './mailstest.csv';
const csvData = fs.readFileSync(csvFilePath, 'utf8');



 // Parse the CSV file to JSON
function parsetojson(csvFile){
 const jsonData = Papa.parse(csvFile, {
     header: true, // Use the first row as keys for JSON
     skipEmptyLines: true // Skip empty lines in CSV
 });
 return jsonData
 }
 // Output JSON

const jsonData=parsetojson(csvData);






 async function sendaMail(params) {
    transporter.sendMail({
        to:params.email1,
        subject:"Help Us Revolutionize Foot Health & Win an Amazon Voucher! 🎁",
        html:`<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f9f9f9; color: #333">
    <div style="max-width: 600px; margin: 20px auto; background: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <p style="font-size: 20px; margin-bottom: 10px; color: #0078d7;">Hi ${params.first_name},</p>
        <p >We hope this message finds you well. We're a health-tech startup collaborating with a renowned chain of hospitals to address leg and foot discomfort. Your insights are crucial in developing innovative solutions that can benefit you and many others. 🌟</p>
        
        <h3 style="margin-top: 20px; color: #333;">Why Participate?</h3>
        <ul style="padding-left: 20px; margin: 10px 0;">
            <li><strong>Make a Difference:</strong> Your feedback will directly influence advancements in foot health technology.</li>
            <li><strong>Exclusive Incentive:</strong> The first 20 participants will receive a ₹500 Amazon voucher as a token of our appreciation.</li>
        </ul>
        
        <h3 style="margin-top: 20px; color: #333;">Quick Survey Details:</h3>
        <ul style="padding-left: 20px; margin: 10px 0;">
            <li><strong>Time to Complete:</strong> Approximately 5 minutes.</li>
            <li><strong>Privacy Assurance:</strong> Your responses will be kept confidential and used solely for research purposes.</li>
        </ul>
        
        <p style="margin-top: 20px;">
            <a href="https://forms.gle/KjxP9uZCFRLjQGsV6" style="display: inline-block; padding: 10px 20px; background-color: #0078d7; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold;">Click here to take the survey</a>
        </p>
        
        <p style="margin-top: 20px; font-size: 14px; color: #555;">Thank you for your valuable time and input. Together, let’s make a significant impact on foot health. 💡</p>
        <p style="margin-top: 10px; font-size: 14px; color: #555;">Best regards,<br>Sole-arium Technologies</p>
    </div>
</body>
`
    }).then((info)=>{sent++,console.log(".Sent: "+sent+"failed: "+failed)}).catch((err)=>{console.log("OOPS"+err);failed++;console.log("Sent: "+sent+"failed: "+failed)})
 }




//  sendaMail({to:"jagveermeena53@gmail.com",subject:"functional test 1",name:"Aryan"})
//  var data=[{to:"prashantrewarjat@gmail.com",subject:"functional test 1",name:"Prashant"},{to:"prashantrewarjat@gmail.com",subject:"functional test 2",name:"Prashant"},{to:"prashantrewarjat@gmail.com",subject:"functional test 3",name:"Prashant"},{to:"prashantrewarjat@gmail.com",subject:"functional test 4",name:"Prashant"},{to:"prashantrewarjat@gmail.com",subject:"functional test 5",name:"Prashant"},{to:"prashantrewarjat@gmail.com",subject:"functional test 6",name:"Prashant"},{to:"prashantrewarjat@gmail.com",subject:"functional test 7",name:"Prashant"},{to:"prashantrewarjat@gmail.com",subject:"functional test 8",name:"Prashant"},{to:"prashantrewarjat@gmail.com",subject:"functional test 9",name:"Prashant"}]
 
 
 for(let i=0;i<jsonData.data.length;i++){ 
    sendaMail(jsonData.data[i])}


// function myAsyncFunction(input) {
//     return new Promise((resolve) => {
//         // Simulate async operation
//         setTimeout(() => {
//             console.log(input);
//             resolve();
//         }, Math.random() * 10);
//     });
// }
 
// const promises = [];
// for (let i = 0; i < 100000; i++) {
//     promises.push(myAsyncFunction(i));
// }

// Promise.all(promises).then(() => {
//     console.log("All operations completed");
// });

// app.listen(port,()=>{
//     console.log("listening on port "+port)
// })