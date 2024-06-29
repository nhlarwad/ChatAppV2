let chatForm=document.querySelector("#chat-form");
let fullMessageBox=document.querySelector(".full-message-box");


let socket=io();

socket.on("msg", message=>{
    console.log(message);
    outputMessage(message);  //Outputs message to DOM

    fullMessageBox.scrollTop=fullMessageBox.scrollHeight;

});

socket.on("user_id", msg=>{
    console.log("front end session ", msg);
    socket.emit("user_connected", msg);
});

socket.on("user_connected", function(user_id){
    console.log("user connected", (user_id));
})

chatForm.addEventListener("submit", (event)=>{
    event.preventDefault();

    let msgInput=document.querySelector("#msg-input").value;
    socket.emit("chatMsg", msgInput);
    document.querySelector("#msg-input").value="";
    document.querySelector("#msg-input").focus();
    
})

function outputMessage(msg){
    let div=document.createElement("div");
    div.classList.add("msg-wrapper");
     div.innerHTML=`<div class="msg-wrapper">
                        <div class="msg">
                            <p>${msg.text}</p>
                        </div>
                        <span id="you-time" class="time">${msg.time}</span>
                    </div>`;
    document.querySelector(".msg-wrapper").appendChild(div);

}

