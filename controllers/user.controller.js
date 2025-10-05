import { addProject as addProjectService, viewAllProject as viewAllProjectService, viewProject as viewProjectService, createTasks as createTasksService, progress as progressService, workload as workloadService } from "../services/user.service.js";

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

export const createTasks = async (req, res) => {
  const { projectId } = req.params;  
  const tasksData = req.body.tasks;  

  if (!projectId) {
    return res.status(400).json({ success: false, message: "Project ID is required in params" });
  }

  // Add projectId to each task
  const tasksWithProject = tasksData.map(task => ({
    ...task,
    projectId: parseInt(projectId, 10)
  }));

  const result = await createTasksService(tasksWithProject);
  res.status(result.status).json(result);
};

export const  progress= async(req,res)=>{
    const { projectId } = req.params;
    const result = await progressService(projectId)
    res.status(result.status).json(result);
}

export const  workload= async(req,res)=>{
    const { projectId } = req.params;
    const result = await workloadService(projectId)
    res.status(result.status).json(result);
}