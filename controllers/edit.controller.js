import { editProgress as editProgressService } from "../services/edit.service.js";

export const editProgress = async(req,res)=>{
    const { progress } = req.body; 
    const { taskId } = req.params;
    const result = await editProgressService(taskId, progress)
    res.status(result.status).json(result);
}
