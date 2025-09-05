import { addProject as addProjectService, viewAllProject as viewAllProjectService, viewProject as viewProjectService } from "../services/user.service.js";

export const addProject = async (req, res) => {
  const createdby = req.user.id;
  const {
    name,
    description,
    startdate,
    endate,
    assignee
  } = req.body;

  const result = await addProjectService({
    name,
    description,
    startdate,
    endate,
    createdby,
    assignee
  });

  return res.status(result.status).json(result);
};

export const viewAllProject = async(req,res)=>{
    const result = await viewAllProjectService(req.user.id)
    res.status(result.status).json(result);
}

export const viewProject = async(req,res)=>{
    const userId = req.user.id;
    const projectId = req.params.projectId;
    const result = await viewProjectService(userId,projectId)
    res.status(result.status).json(result);
}


