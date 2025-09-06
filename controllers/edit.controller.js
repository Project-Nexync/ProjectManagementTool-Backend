import { editProgress as editProgressService, editduedate as editduedateService, addMember as addMemberService } from "../services/edit.service.js";

export const editProgress = async(req,res)=>{
    const { progress } = req.body; 
    const { taskId } = req.params;
    const result = await editProgressService(taskId, progress)
    res.status(result.status).json(result);
}

export const editduedate = async(req,res)=>{
    const { duedate } = req.body; 
    const { taskId } = req.params;
    const result = await editduedateService(taskId, duedate)
    res.status(result.status).json(result);
}

export const addMember = async(req,res)=>{
    const { projectId } = req.params;
    const invitedby = req.user.id;
    const {assignee} = req.body;
    const result = await addMemberService(projectId, assignee, invitedby)
    res.status(result.status).json(result);
}