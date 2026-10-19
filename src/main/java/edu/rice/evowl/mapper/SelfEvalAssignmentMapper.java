package edu.rice.evowl.mapper;

import edu.rice.evowl.entity.SelfEvalAssignment;
import org.apache.ibatis.annotations.*;

public interface SelfEvalAssignmentMapper {
  @Insert(
    "INSERT into self_eval_assignment (unique_id,assignment_id,user_id,status) SELECT #{unique_id},#{assignment_id},#{userId},FALSE WHERE not exists (SELECT 1 from self_eval_assignment WHERE status = FALSE AND user_id = #{userId} AND assignment_id = #{assignment_id})"
  )
  void createAssignment(SelfEvalAssignment selfEvalAssignment);

  @Update(
    "UPDATE self_eval_assignment SET status = #{status} WHERE unique_id = #{unique_id}"
  )
  void updateAssignmentStatus(
    @Param("unique_id") String uniqueId,
    @Param("status") boolean status
  );

  @Select(
    "SELECT COUNT(*) FROM self_eval_assignment WHERE user_id = #{userId} AND assignment_id = #{assignment_id}"
  )
  int getTotalRowsByUserIdAndAssignmentId(
    @Param("userId") String userId,
    @Param("assignment_id") long assignmentId
  );

  @Select("SELECT *, user_id AS userId from self_eval_assignment where unique_id=#{unique_id}")
  SelfEvalAssignment getSelfEvalAssignmentById(
    @Param("unique_id") String unique_id
  );

  @Select(
    "SELECT *, user_id AS userId FROM self_eval_assignment WHERE user_id = #{userId} AND assignment_id = #{assignment_id} AND status != 1 LIMIT 1"
  )
  SelfEvalAssignment getSelfEvalAssignmentByUserIdStatusAndAssignmentId(
    @Param("userId") String userId,
    @Param("assignment_id") long assignmentId
  );
}
