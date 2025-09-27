import { register,login } from "../services/auth.service.js";



export const registerUser = async(req,res)=>{
    const result = await register(req.body)
    res.status(result.status).json(result);
}

export const loginUser = async(req,res)=>{
    const result = await login(req.body)
    res.status(result.status).json(result);
}

