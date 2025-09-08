import { editProgress as editProgressService, editduedate as editduedateService, addMember as addMemberService, addAssignee as addAssigneeService, editTaskDescription as editTaskDescriptionService, deletetask as deletetaskService } from "../services/edit.service.js";

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

export const addAssignee = async(req,res)=>{
    const {projectId,taskId } = req.params;
    const userId = req.user.id;
    const {assignee} = req.body;
    const result = await addAssigneeService(projectId, assignee, taskId, userId)
    res.status(result.status).json(result);
}

export const editTaskDescription = async(req,res)=>{
    const {taskId } = req.params;
    const {task_name} = req.body;
    const result = await editTaskDescriptionService(taskId,task_name)
    res.status(result.status).json(result);
}

export const deletetask = async(req,res)=>{
    const {taskId } = req.params;
    const result = await deletetaskService(taskId)
    res.status(result.status).json(result);
}