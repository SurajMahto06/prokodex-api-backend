import { Router } from 'express';
import { assignmentController } from '../controllers/assignmentController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate as any);

router.get('/', assignmentController.getAssignments);
router.post('/', assignmentController.createAssignment);
router.get('/:id', assignmentController.getAssignmentById);
router.put('/:id', assignmentController.updateAssignment);
router.put('/:id/submit', assignmentController.submitAssignment);
router.delete('/:id', assignmentController.deleteAssignment);

export default router;
