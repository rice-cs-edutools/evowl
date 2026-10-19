package edu.rice.evowl.mapper;

import edu.rice.evowl.entity.Submission;
import java.util.List;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface SubmissionMapper {
  @Select(
    "SELECT s.* " +
      "FROM submission s " +
      "INNER JOIN assignment a ON s.assignment_id = a.assignment_id " +
      "WHERE a.student_submission_ddl >= NOW() " +
      "AND s.group_id NOT IN (" +
      "    SELECT u.group_id " +
      "    FROM user u " +
      "    WHERE u.user_id = #{userId}" +
      ") " +
      "AND s.assignment_id = (" +
      "    SELECT MIN(s2.assignment_id) " +
      "    FROM submission s2 " +
      "    INNER JOIN assignment a2 ON s2.assignment_id = a2.assignment_id " +
      "    WHERE a2.student_submission_ddl >= NOW() " +
      "    AND s2.group_id NOT IN (" +
      "        SELECT u2.group_id " +
      "        FROM user u2 " +
      "        WHERE u2.user_id = #{userId}" +
      "    )" +
      ")"
  )
  List<Submission> selectSubmissionsByUserId(@Param("userId") String userId);

  @Select("SELECT * FROM submission")
  List<Submission> getAllSubmissions();

  @Select("SELECT * FROM submission WHERE assignment_id = #{assignment_id}")
  List<Submission> getAllSubmissionsByAssignmentId(
    @Param("assignment_id") long assignmentId
  );

  @Select("SELECT group_id FROM submission")
  List<String> getAllGroupIds();

  @Select("SELECT * from submission where submission_id=#{submission_id}")
  Submission getSubmissionById(@Param("submission_id") String submission_id);

  @Select(
    "SELECT assignment_id " +
      "FROM submission " +
      "WHERE submission_id = #{submission.submission_id}"
  )
  Long getAssignmentIdBySubmission(@Param("submission") Submission submission);

  @Select(
    "SELECT group_id " +
      "FROM submission " +
      "WHERE submission_id = #{submission.submission_id}"
  )
  String getGroupIdBySubmission(@Param("submission") Submission submission);

  @Select(
    "SELECT submission_path " +
      "FROM submission " +
      "WHERE submission_id = #{submission.submission_id}"
  )
  String getSubmissionPathBySubmission(
    @Param("submission") Submission submission
  );
}
