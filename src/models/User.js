import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    tgId:{
        type:String,
        required:true,
        unique:true
    },
    firstName:{
        type:String,
        required:true
    },
    lastName:{
        type:String,
        required:true
    },
    isBot:{
        type:Boolean,
        require:true
    },
    username:{
        type:String,
        required:true,
        unique:true
    },
    promptTokensCount:{
        type:Number,
        required:false,
    },
    candidatesTokenCount:{
        type:Number,
        required:false
    }
},{timestamps:true});


export default mongoose.model('User',userSchema);