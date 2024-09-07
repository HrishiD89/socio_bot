import mongoose, { connect } from "mongoose";

export default ()=>{
    return mongoose.connect(process.env.MONGO_CONNECTION_STRING)
}