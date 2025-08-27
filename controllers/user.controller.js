import { addProject as addProjectService } from "../services/user.service.js";

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
