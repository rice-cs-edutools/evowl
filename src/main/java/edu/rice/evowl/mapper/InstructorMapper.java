package edu.rice.evowl.mapper;

import edu.rice.evowl.entity.Instructor;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface InstructorMapper {
  @Select("SELECT *, user_id AS userId from instructor where user_id=#{userId}")
  Instructor findByUserId(@Param("userId") String userId);

  @Select("SELECT criteria_id FROM instructor_criteria_assignment WHERE user_id=#{userId} AND assign_id=#{assign_id}")
  List<Long> findCriteriaIdsByUserIdAndAssignmentId(@Param("userId") String userId, @Param("assign_id") long assign_id);
}
