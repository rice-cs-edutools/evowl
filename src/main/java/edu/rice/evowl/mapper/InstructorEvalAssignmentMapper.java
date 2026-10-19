package edu.rice.evowl.mapper;

import edu.rice.evowl.entity.InstructorEvalAssignment;
import java.util.List;
import org.apache.ibatis.annotations.*;

public interface InstructorEvalAssignmentMapper {
  @Insert(
    "INSERT into instructor_eval_assignment(unique_id, assignment_id, round, idx, user_id, group_id, criteria_id, status) SELECT #{unique_id}, #{assignment_id}, #{round}, #{idx}, #{userId}, #{group_id}, #{criteria_id}, FALSE"
  )
  void saveAssignmentGrouping(
    InstructorEvalAssignment instructorEvalAssignment
  );

  @Select(
    "SELECT assignment_id FROM instructor_eval_assignment WHERE user_id = #{userId} ORDER BY assignment_id DESC LIMIT 1"
  )
  Long getLastUpdatedAssignIdByUserId(@Param("userId") String userId);

  @Select(
    "SELECT *, user_id AS userId FROM instructor_eval_assignment WHERE assignment_id = #{assignment_id}"
  )
  List<InstructorEvalAssignment> getAllEvalAssignmentsByAssignmentId(
    @Param("assignment_id") long assignmentId
  );

  @Update(
    "UPDATE instructor_eval_assignment SET status = #{status} WHERE unique_id = #{unique_id}"
  )
  void updateAssignmentStatus(
    @Param("unique_id") String uniqueId,
    @Param("status") boolean status
  );

  @Select(
    "SELECT COUNT(*) FROM instructor_eval_assignment WHERE user_id = #{userId} AND assignment_id = #{assignment_id}"
  )
  int getTotalRowsByUserIdAndAssignmentId(
    @Param("userId") String userId,
    @Param("assignment_id") long assignmentId
  );

  @Select(
    "SELECT *, user_id AS userId from instructor_eval_assignment where unique_id=#{unique_id}"
  )
  InstructorEvalAssignment getInstructorEvalAssignmentById(
    @Param("unique_id") String unique_id
  );

  @Select(
    "SELECT *, user_id AS userId FROM instructor_eval_assignment WHERE user_id = #{userId} AND assignment_id = #{assignment_id} AND round = 1"
  )
  List<
    InstructorEvalAssignment
  > getAllInstructorEvalAssignmentsByUserIdRound2AndAssignmentId(
    @Param("userId") String userId,
    @Param("assignment_id") long assignmentId
  );

  @Select(
    "SELECT *, user_id AS userId FROM instructor_eval_assignment WHERE user_id = #{userId} AND assignment_id = #{assignment_id} AND round = 1 AND status != 1  ORDER BY idx LIMIT 1"
  )
  InstructorEvalAssignment getInstructorEvalAssignmentByUserIdRound2IncompleteAndAssignmentId(
    @Param("userId") String userId,
    @Param("assignment_id") long assignmentId
  );

  @Select(
    "SELECT *, user_id AS userId FROM instructor_eval_assignment WHERE user_id = #{userId} AND assignment_id = #{assignment_id} AND status != 1 LIMIT 1"
  )
  InstructorEvalAssignment getInstructorEvalAssignmentByUserIdStatusAndAssignmentId(
    @Param("userId") String userId,
    @Param("assignment_id") long assignmentId
  );

  @Select("SELECT *, user_id AS userId from instructor_eval_assignment where group_id=#{group_id}")
  List<InstructorEvalAssignment> getInstructorEvalAssignmentByGroup(
    @Param("group_id") String unique_id
  );
}
