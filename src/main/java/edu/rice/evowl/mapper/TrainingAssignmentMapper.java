package edu.rice.evowl.mapper;

import edu.rice.evowl.entity.TrainingAssignment;
import org.apache.ibatis.annotations.*;

public interface TrainingAssignmentMapper {
  @Insert(
    "INSERT INTO training_assignment (unique_id, assignment_id, user_id, status) SELECT #{unique_id}, #{assignment_id},#{userId}, FALSE WHERE not exists (SELECT 1 from training_assignment WHERE status = FALSE AND user_id = #{userId} AND assignment_id = #{assignment_id})"
  )
  void createAssignment(TrainingAssignment trainingAssignment);

  @Update(
    "UPDATE training_assignment SET status = #{status} WHERE unique_id = #{unique_id}"
  )
  void updateAssignmentStatus(
    @Param("unique_id") String uniqueId,
    @Param("status") boolean status
  );

  @Select(
    "SELECT COUNT(*) FROM training_assignment WHERE user_id = #{userId} AND assignment_id = #{assignment_id}"
  )
  int getTotalRowsByUserIdAndAssignmentId(
    @Param("userId") String userId,
    @Param("assignment_id") Long assignment_Id
  );

  @Select(
    "SELECT *, user_id AS userId FROM training_assignment WHERE user_id = #{userId} AND assignment_id = #{assignment_id} AND status != 1 LIMIT 1"
  )
  TrainingAssignment getTrainingAssignmentByUserIdStatusAndAssignmentId(
    @Param("userId") String userId,
    @Param("assignment_id") long assignmentId
  );

  @Select("SELECT *, user_id AS userId FROM training_assignment WHERE unique_id = #{unique_id}")
  TrainingAssignment getTrainingAssignmentById(
    @Param("unique_id") String unique_id
  );

  @Select(
    "SELECT status FROM training_assignment WHERE unique_id = #{unique_id}"
  )
  Integer getStatusById(@Param("unique_id") String unique_id);
}
