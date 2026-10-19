package edu.rice.evowl.mapper;

import edu.rice.evowl.entity.Student;
import java.util.List;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface StudentMapper {
  @Select("SELECT *, user_id AS userId from student where user_id=#{userId}")
  Student findByUserId(@Param("userId") String userId);

  @Select("SELECT *, user_id AS userId from student")
  List<Student> getAllStudents();

  @Select("SELECT group_id FROM student_assignment_group WHERE user_id=#{userId} AND assignment_id=#{assignment_id}")
  String getGroupIdByUserIdAndAssignmentId(
    @Param("userId") String userId,
    @Param("assignment_id") long assignmentId
  );
}
