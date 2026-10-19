package edu.rice.evowl.entity;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import java.util.Date;
import lombok.Data;

@Data
@ApiModel("assignment info")
public class Assignment {

  @ApiModelProperty("assignment id")
  private Long assignment_id;

  @ApiModelProperty("assignment name")
  private String assignment_name;

  @ApiModelProperty("student grading deadline")
  private Date student_submission_ddl;
}
