package edu.rice.evowl.mapper;

import edu.rice.evowl.entity.PeerEvalAssignment;
import java.util.List;
import org.apache.ibatis.annotations.*;

public interface PeerEvalAssignmentMapper {
  @Insert(
    "INSERT into peer_eval_assignment (unique_id,assignment_id,user_id,group1_id,group2_id,status) SELECT #{unique_id},#{assignment_id},#{userId},#{group1_id},#{group2_id},FALSE WHERE not exists (SELECT 1 from peer_eval_assignment WHERE status = FALSE AND user_id = #{userId} AND assignment_id = #{assignment_id})"
  )
  void saveAssignmentGrouping(PeerEvalAssignment peerEvalAssignment);

  @Select(
    "SELECT *, user_id AS userId FROM peer_eval_assignment WHERE assignment_id = #{assignment_id}"
  )
  List<PeerEvalAssignment> getAllEvalAssignmentsByAssignmentId(
    @Param("assignment_id") long assignmentId
  );

  @Select(
    "SELECT assignment_id FROM peer_eval_assignment WHERE user_id = #{userId} ORDER BY assignment_id DESC LIMIT 1"
  )
  Long getLastUpdatedAssignIdByUserId(@Param("userId") String userId);

  @Update(
    "UPDATE peer_eval_assignment SET status = #{status} WHERE unique_id = #{unique_id}"
  )
  void updateAssignmentStatus(
    @Param("unique_id") String uniqueId,
    @Param("status") boolean status
  );

  @Select(
    "SELECT COUNT(*) FROM peer_eval_assignment WHERE user_id = #{userId} AND assignment_id = #{assignment_id}"
  )
  int getTotalRowsByUserIdAndAssignmentId(
    @Param("userId") String userId,
    @Param("assignment_id") long assignmentId
  );

  @Select("SELECT *, user_id AS userId from peer_eval_assignment where unique_id=#{unique_id}")
  PeerEvalAssignment getPeerEvalAssignmentById(
    @Param("unique_id") String unique_id
  );

  @Select(
    "SELECT *, user_id AS userId FROM peer_eval_assignment WHERE user_id = #{userId} AND assignment_id = #{assignment_id} AND status = false LIMIT 1"
  )
  PeerEvalAssignment getPeerEvalAssignmentByUserIdStatusAndAssignmentId(
    @Param("userId") String userId,
    @Param("assignment_id") long assignmentId
  );

  @Select(
    "SELECT *, user_id AS userId FROM peer_eval_assignment WHERE user_id = #{userId} AND assignment_id = #{assignment_id}"
  )
  List<PeerEvalAssignment> getPeerEvalAssignmentsByUserIdAndAssignmentId(
    @Param("userId") String userId,
    @Param("assignment_id") long assignmentId
  );
}
